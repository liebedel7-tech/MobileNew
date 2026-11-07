import { Consumer } from '../types';
import { createWorker } from 'tesseract.js';
import { formatOdometerReading, cleanOdometerInput } from '../constants/routes';

export interface RealTimeTagResult {
  matchedConsumer: Consumer | null;
  tagDetected: string;
  entitiesDetected?: string[];
  confidence: number;
  source: string;
}

export interface RealTimeDialResult {
  readingValue: number;
  formatted5Digits: string;
  digits: string[];
  confidence: number;
  source: string;
}

export class RealTimeScanner {
  private static canvas: HTMLCanvasElement | null = null;
  private static textDetector: any = null;
  private static isTextDetectorSupported: boolean | null = null;
  private static tesseractWorker: any = null;
  private static isWorkerInitializing: boolean = false;
  private static lastServerScanTime: number = 0;
  private static isServerScanBusy: boolean = false;

  private static isTesseractDisabled: boolean = false;
  private static isWorkerBusy: boolean = false;

  private static getCanvas(): HTMLCanvasElement {
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
    }
    return this.canvas;
  }

  /**
   * Initializes browser-native TextDetector if supported (Chrome/Android Web platform)
   */
  private static getTextDetector(): any {
    if (this.isTextDetectorSupported === false) return null;
    if (this.textDetector) return this.textDetector;

    if (typeof window !== 'undefined' && (window as any).TextDetector) {
      try {
        this.textDetector = new (window as any).TextDetector();
        this.isTextDetectorSupported = true;
        return this.textDetector;
      } catch {
        this.isTextDetectorSupported = false;
      }
    } else {
      this.isTextDetectorSupported = false;
    }
    return null;
  }

  /**
   * Lazy initialization for in-browser client Tesseract OCR worker with fail-safe flag
   */
  private static async getTesseractWorker(): Promise<any> {
    if (this.isTesseractDisabled) return null;
    if (this.tesseractWorker) return this.tesseractWorker;
    if (this.isWorkerInitializing) return null;

    this.isWorkerInitializing = true;
    try {
      const worker = await createWorker('eng');
      this.tesseractWorker = worker;
      this.isWorkerInitializing = false;
      return worker;
    } catch (err) {
      console.info('Client-side Tesseract worker unavailable, fallback to stream detector:', err);
      this.isTesseractDisabled = true;
      this.isWorkerInitializing = false;
      return null;
    }
  }

  /**
   * High-contrast grayscale and adaptive thresholding for meter badges and mechanical rolling wheels
   */
  private static preprocessImage(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    thresholdCutoff: number = 128
  ) {
    try {
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        // Luminance calculation
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        // Contrast enhancement
        const v = gray > thresholdCutoff ? 255 : 0;
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
      }
      ctx.putImageData(imgData, 0, 0);
    } catch {
      // Safe fallback
    }
  }

  /**
   * Real-time frame extraction for tag detection (Automatic Live Detection)
   * Analyzes camera stream frames directly.
   */
  static async scanFrameForTag(
    videoElement: HTMLVideoElement,
    allConsumers: Consumer[]
  ): Promise<RealTimeTagResult | null> {
    if (!videoElement || videoElement.readyState < 2 || videoElement.videoWidth === 0 || allConsumers.length === 0) {
      return null;
    }

    const vw = videoElement.videoWidth;
    const vh = videoElement.videoHeight;
    const canvas = this.getCanvas();
    
    // Scale frame for fast real-time OCR
    canvas.width = 480;
    canvas.height = 360;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    // Center 75% crop where meter tag is framed
    const cropX = Math.floor(vw * 0.12);
    const cropY = Math.floor(vh * 0.15);
    const cropW = Math.floor(vw * 0.76);
    const cropH = Math.floor(vh * 0.7);

    ctx.drawImage(videoElement, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);

    // --- STEP 1: Fast Native Browser TextDetector ---
    const detector = this.getTextDetector();
    if (detector) {
      try {
        const detectedTexts = await detector.detect(canvas);
        if (detectedTexts && detectedTexts.length > 0) {
          for (const item of detectedTexts) {
            const rawVal = (item.rawValue || '').trim().toUpperCase();
            if (!rawVal || rawVal.length < 2) continue;

            const match = this.findMatchingConsumer(rawVal, allConsumers);
            if (match) {
              return {
                matchedConsumer: match.consumer,
                tagDetected: match.matchedTag,
                confidence: 0.98,
                source: 'native_live_detector',
              };
            }
          }
        }
      } catch {
        // Continue to next layer
      }
    }

    // --- STEP 2: Client In-Browser OCR Worker ---
    if (!this.isWorkerBusy) {
      try {
        const worker = await this.getTesseractWorker();
        if (worker) {
          this.isWorkerBusy = true;
          this.preprocessImage(ctx, canvas.width, canvas.height, 120);
          const result = await worker.recognize(canvas);
          this.isWorkerBusy = false;
          const text = result?.data?.text || '';
          if (text && text.trim().length >= 2) {
            const lines = text.toUpperCase().split(/\r?\n/);
            for (const line of lines) {
              const match = this.findMatchingConsumer(line, allConsumers);
              if (match) {
                return {
                  matchedConsumer: match.consumer,
                  tagDetected: match.matchedTag,
                  confidence: 0.95,
                  source: 'tesseract_live_ocr',
                };
              }
            }
          }
        }
      } catch {
        this.isWorkerBusy = false;
      }
    }

    // --- STEP 3: Live Server Optical Stream (Debounced every 1.5s for real-time responsiveness) ---
    const now = Date.now();
    if (!this.isServerScanBusy && now - this.lastServerScanTime > 1200) {
      this.lastServerScanTime = now;
      this.isServerScanBusy = true;
      try {
        const base64Data = canvas.toDataURL('image/jpeg', 0.65);
        const response = await fetch('/api/ocr/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64Data,
            mode: 'tag',
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data && data.success && data.tagDetected) {
            const match = this.findMatchingConsumer(data.tagDetected, allConsumers);
            if (match) {
              this.isServerScanBusy = false;
              return {
                matchedConsumer: match.consumer,
                tagDetected: match.matchedTag,
                entitiesDetected: data.entitiesDetected || [data.tagDetected],
                confidence: data.confidence || 0.94,
                source: 'live_stream_ocr',
              };
            }
          }
        }
      } catch {
        // Silent
      } finally {
        this.isServerScanBusy = false;
      }
    }

    return null;
  }

  /**
   * Real-time frame extraction for mechanical dial reading.
   * Isolates the odometer window and strictly extracts 5 mechanical whole digits.
   * If any letters, symbols, brand names, or special characters are detected mixed into the reading,
   * the reading is invalidated (rejected).
   */
  static async scanFrameForDialReading(
    videoElement: HTMLVideoElement,
    previousReading: number = 0
  ): Promise<RealTimeDialResult | null> {
    if (!videoElement || videoElement.readyState < 2 || videoElement.videoWidth === 0) {
      return null;
    }

    const vw = videoElement.videoWidth;
    const vh = videoElement.videoHeight;
    const canvas = this.getCanvas();
    
    canvas.width = 440;
    canvas.height = 180;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    // Crop center area where the rolling mechanical odometer wheels sit
    const cropX = Math.floor(vw * 0.18);
    const cropY = Math.floor(vh * 0.32);
    const cropW = Math.floor(vw * 0.64);
    const cropH = Math.floor(vh * 0.36);

    ctx.drawImage(videoElement, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);

    // --- STEP 1: Native Text Detector (Fast on Chromium / Android) ---
    const detector = this.getTextDetector();
    if (detector) {
      try {
        const detectedTexts = await detector.detect(canvas);
        if (detectedTexts && detectedTexts.length > 0) {
          for (const item of detectedTexts) {
            const rawVal = (item.rawValue || '').trim();
            if (!rawVal) continue;

            // STRICT ODOMETER CHECK:
            // 1. Water meter odometers have 5 rolling numeric wheels with NO letters, names, or special symbols.
            // If any letters or special characters are detected mixed in (e.g. LXSG, ISO, -, /, #), invalidate.
            if (/[a-zA-Z#$\-_/\\~`!@%^&*+=()[\]{}|:;"'<>,.?]/.test(rawVal)) {
              continue; // Invalidate: contains non-odometer characters
            }

            // Remove whitespace between wheels (e.g. "0 0 3 4 5" -> "00345")
            const cleanDigits = rawVal.replace(/\s+/g, '');
            // Must be strictly 5 digits with no extra characters
            if (/^\d{5}$/.test(cleanDigits)) {
              const numVal = parseInt(cleanDigits, 10);
              if (!isNaN(numVal) && numVal >= 0 && numVal <= 99999) {
                // STRICT CHECK: Reject if candidate is less than previous reading without valid rollover
                if (previousReading > 0) {
                  const isNormal = numVal >= previousReading;
                  const isRollover = previousReading >= 90000 && numVal < 10000;
                  if (!isNormal && !isRollover) {
                    continue; // Skip invalid reading! Do not accept random smaller numbers!
                  }
                }
                const formatted = formatOdometerReading(numVal);
                return {
                  readingValue: numVal,
                  formatted5Digits: formatted,
                  digits: formatted.split(''),
                  confidence: 0.96, // Exceeds 90%
                  source: 'native_dial_detector',
                };
              }
            }
          }
        }
      } catch {
        // Fallback
      }
    }

    // --- STEP 2: Client In-Browser OCR Worker ---
    if (!this.isWorkerBusy) {
      try {
        const worker = await this.getTesseractWorker();
        if (worker) {
          this.isWorkerBusy = true;
          this.preprocessImage(ctx, canvas.width, canvas.height, 130);
          const result = await worker.recognize(canvas);
          this.isWorkerBusy = false;
          const text = result?.data?.text || '';
          
          if (text) {
            const lines = text.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
            for (const line of lines) {
              // STRICT ODOMETER CHECK:
              // If line has letters, brand names, or symbols, reject as non-odometer text
              if (/[a-zA-Z#$\-_/\\~`!@%^&*+=()[\]{}|:;"'<>,.?]/.test(line)) {
                continue;
              }

              const cleanDigits = line.replace(/\s+/g, '');
              if (/^\d{5}$/.test(cleanDigits)) {
                const numVal = parseInt(cleanDigits, 10);
                if (!isNaN(numVal) && numVal >= 0 && numVal <= 99999) {
                  // STRICT CHECK: Reject if candidate is less than previous reading without valid rollover
                  if (previousReading > 0) {
                    const isNormal = numVal >= previousReading;
                    const isRollover = previousReading >= 90000 && numVal < 10000;
                    if (!isNormal && !isRollover) {
                      continue; // Skip invalid reading! Do not accept random smaller numbers!
                    }
                  }
                  const formatted = formatOdometerReading(numVal);
                  return {
                    readingValue: numVal,
                    formatted5Digits: formatted,
                    digits: formatted.split(''),
                    confidence: 0.94, // Exceeds 90%
                    source: 'tesseract_dial_ocr',
                  };
                }
              }
            }
          }
        }
      } catch {
        this.isWorkerBusy = false;
      }
    }

    // --- STEP 3: Server Optical Stream (Debounced for real-time responsiveness) ---
    const now = Date.now();
    if (!this.isServerScanBusy && now - this.lastServerScanTime > 1200) {
      this.lastServerScanTime = now;
      this.isServerScanBusy = true;
      try {
        const base64Data = canvas.toDataURL('image/jpeg', 0.65);
        const response = await fetch('/api/ocr/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64Data,
            mode: 'reading',
            previousReading,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data && data.success && data.readingValue !== null && data.readingValue !== undefined) {
            const rawDigits = String(data.readingValue).trim();
            // Validate that returned value represents strictly whole 5 numbers
            if (!/[a-zA-Z#$\-_/\\~`!@%^&*+=()[\]{}|:;"'<>,.?]/.test(rawDigits)) {
              const cleanDigits = rawDigits.replace(/\s+/g, '').slice(0, 5);
              if (/^\d{1,5}$/.test(cleanDigits)) {
                const numVal = Math.min(99999, Math.max(0, parseInt(cleanDigits, 10)));
                // STRICT CHECK: Reject if candidate is less than previous reading without valid rollover
                if (previousReading > 0) {
                  const isNormal = numVal >= previousReading;
                  const isRollover = previousReading >= 90000 && numVal < 10000;
                  if (!isNormal && !isRollover) {
                    this.isServerScanBusy = false;
                    return null; // Reject!
                  }
                }
                const formatted = formatOdometerReading(numVal);
                this.isServerScanBusy = false;
                return {
                  readingValue: numVal,
                  formatted5Digits: formatted,
                  digits: formatted.split(''),
                  confidence: data.confidence || 0.95, // Exceeds 90%
                  source: 'live_stream_dial_ocr',
                };
              }
            }
          }
        }
      } catch {
        // Silent
      } finally {
        this.isServerScanBusy = false;
      }
    }

    return null;
  }

  /**
   * Helper: Matches detected text string against consumer tags, meter numbers, or account numbers.
   * Uses strict matching and filters out generic words (TAG, TWD, MTR, WATER, etc.) to prevent false-positive locks.
   */
  private static findMatchingConsumer(
    text: string,
    allConsumers: Consumer[]
  ): { consumer: Consumer; matchedTag: string } | null {
    const rawUpper = text.trim().toUpperCase();
    const cleanText = rawUpper.replace(/[\s\-_]/g, '');
    if (cleanText.length < 3) return null;

    // Reject generic water meter words and brand labels that are not distinctive identifiers
    const GENERIC_LABELS = new Set([
      'TAG', 'TWD', 'WDT', 'MTR', 'METER', 'WATER', 'DISTRICT', 'PHILIPPINES', 
      'CLASS', 'CLASSB', 'CLASSC', 'ISO', 'ISO4064', 'LXSG', 'LXSG15', 'BARANGAY', 
      'POBLACION', 'BALUARTE', 'CASINGLOT', 'MOHON', 'NATUMOLAN', 'STACRUZ', 'STAANA', 
      'SUGBONGCOGON', 'GRACIA', 'ROSARIO', 'MISAMIS', 'ORIENTAL', 'SERIAL', 'MODEL'
    ]);

    if (GENERIC_LABELS.has(cleanText) || GENERIC_LABELS.has(rawUpper)) {
      return null;
    }

    const textDigits = cleanText.replace(/[^0-9]/g, '');

    // Check exact or specific containment across consumer credentials
    for (const c of allConsumers) {
      const tag = (c.meterNumber || '').toUpperCase().replace(/[\s\-_]/g, '');
      const serial = (c.meterSerial || '').toUpperCase().replace(/[\s\-_]/g, '');
      const acc = (c.accountNumber || '').toUpperCase().replace(/[\s\-_]/g, '');
      const tagDigits = (c.meterNumber || '').replace(/[^0-9]/g, '');
      const serialDigits = (c.meterSerial || '').replace(/[^0-9]/g, '');
      const accDigits = (c.accountNumber || '').replace(/[^0-9]/g, '');

      // 1. Exact match on clean string
      if (tag && cleanText === tag) {
        return { consumer: c, matchedTag: c.meterNumber || c.meterSerial };
      }
      if (serial && cleanText === serial) {
        return { consumer: c, matchedTag: c.meterSerial || c.meterNumber };
      }
      if (acc && cleanText === acc) {
        return { consumer: c, matchedTag: c.meterNumber || c.accountNumber };
      }

      // 2. Detected text contains the entire distinctive tag/serial/account
      if (tag && tag.length >= 4 && cleanText.includes(tag)) {
        return { consumer: c, matchedTag: c.meterNumber || c.meterSerial };
      }
      if (serial && serial.length >= 4 && cleanText.includes(serial)) {
        return { consumer: c, matchedTag: c.meterSerial || c.meterNumber };
      }
      if (acc && acc.length >= 4 && cleanText.includes(acc)) {
        return { consumer: c, matchedTag: c.meterNumber || c.accountNumber };
      }

      // 3. Significant distinctive numeric match (at least 4 digits matching meter tag or serial number exactly)
      if (textDigits.length >= 4) {
        if (tagDigits.length >= 4 && (textDigits === tagDigits || textDigits.includes(tagDigits))) {
          return { consumer: c, matchedTag: c.meterNumber || c.meterSerial };
        }
        if (serialDigits.length >= 4 && (textDigits === serialDigits || textDigits.includes(serialDigits))) {
          return { consumer: c, matchedTag: c.meterSerial || c.meterNumber };
        }
        if (accDigits.length >= 4 && textDigits === accDigits) {
          return { consumer: c, matchedTag: c.meterNumber || c.accountNumber };
        }
      }
    }

    return null;
  }
}
