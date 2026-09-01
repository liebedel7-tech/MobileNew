import { Consumer } from '../types';
import { createWorker } from 'tesseract.js';

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
   * Lazy initialization for in-browser client Tesseract OCR worker
   */
  private static async getTesseractWorker(): Promise<any> {
    if (this.tesseractWorker) return this.tesseractWorker;
    if (this.isWorkerInitializing) return null;

    this.isWorkerInitializing = true;
    try {
      const worker = await createWorker('eng');
      this.tesseractWorker = worker;
      this.isWorkerInitializing = false;
      return worker;
    } catch (err) {
      console.warn('Tesseract client worker init notice:', err);
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
    try {
      const worker = await this.getTesseractWorker();
      if (worker) {
        // Preprocess high contrast
        this.preprocessImage(ctx, canvas.width, canvas.height, 120);
        const result = await worker.recognize(canvas);
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
      // Continue to live server optical stream
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
   * Isolates the odometer window and extracts 5 digits.
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
    
    canvas.width = 400;
    canvas.height = 160;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    // Crop center 50% where the rolling odometer reticle is located
    const cropX = Math.floor(vw * 0.2);
    const cropY = Math.floor(vh * 0.35);
    const cropW = Math.floor(vw * 0.6);
    const cropH = Math.floor(vh * 0.3);

    ctx.drawImage(videoElement, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);

    // --- STEP 1: Native Text Detector ---
    const detector = this.getTextDetector();
    if (detector) {
      try {
        const detectedTexts = await detector.detect(canvas);
        if (detectedTexts && detectedTexts.length > 0) {
          for (const item of detectedTexts) {
            const rawDigits = (item.rawValue || '').replace(/[^0-9]/g, '');
            if (rawDigits.length >= 4 && rawDigits.length <= 6) {
              const numVal = parseInt(rawDigits.slice(0, 5), 10);
              if (!isNaN(numVal) && numVal >= 0) {
                const formatted = String(numVal).padStart(5, '0');
                return {
                  readingValue: numVal,
                  formatted5Digits: formatted,
                  digits: formatted.split(''),
                  confidence: 0.96,
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
    try {
      const worker = await this.getTesseractWorker();
      if (worker) {
        this.preprocessImage(ctx, canvas.width, canvas.height, 130);
        const result = await worker.recognize(canvas);
        const text = result?.data?.text || '';
        const rawDigits = text.replace(/[^0-9]/g, '');
        if (rawDigits.length >= 4 && rawDigits.length <= 6) {
          const numVal = parseInt(rawDigits.slice(0, 5), 10);
          if (!isNaN(numVal) && numVal >= 0) {
            const formatted = String(numVal).padStart(5, '0');
            return {
              readingValue: numVal,
              formatted5Digits: formatted,
              digits: formatted.split(''),
              confidence: 0.93,
              source: 'tesseract_dial_ocr',
            };
          }
        }
      }
    } catch {
      // Continue
    }

    // --- STEP 3: Server Optical Stream ---
    const now = Date.now();
    if (!this.isServerScanBusy && now - this.lastServerScanTime > 1400) {
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
            const numVal = parseInt(String(data.readingValue).replace(/[^0-9]/g, ''), 10);
            if (!isNaN(numVal) && numVal >= 0) {
              const formatted = String(numVal).padStart(5, '0');
              this.isServerScanBusy = false;
              return {
                readingValue: numVal,
                formatted5Digits: formatted,
                digits: formatted.split(''),
                confidence: data.confidence || 0.94,
                source: 'live_stream_dial_ocr',
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
   * Helper: Matches detected text string against consumer tags, meter numbers, or account numbers.
   */
  private static findMatchingConsumer(
    text: string,
    allConsumers: Consumer[]
  ): { consumer: Consumer; matchedTag: string } | null {
    const cleanText = text.trim().toUpperCase().replace(/[\s\-_]/g, '');
    if (cleanText.length < 2) return null;

    // Check exact or partial containment across consumer credentials
    for (const c of allConsumers) {
      const tag = (c.meterNumber || '').toUpperCase().replace(/[\s\-_]/g, '');
      const serial = (c.meterSerial || '').toUpperCase().replace(/[\s\-_]/g, '');
      const acc = (c.accountNumber || '').toUpperCase().replace(/[\s\-_]/g, '');
      const numOnly = (c.meterNumber || '').replace(/[^0-9]/g, '');

      if (tag && (cleanText === tag || (tag.length >= 3 && cleanText.includes(tag)) || (cleanText.length >= 3 && tag.includes(cleanText)))) {
        return { consumer: c, matchedTag: c.meterNumber || c.meterSerial };
      }
      if (serial && (cleanText === serial || (serial.length >= 3 && cleanText.includes(serial)) || (cleanText.length >= 3 && serial.includes(cleanText)))) {
        return { consumer: c, matchedTag: c.meterSerial || c.meterNumber };
      }
      if (acc && (cleanText === acc || (acc.length >= 3 && cleanText.includes(acc)))) {
        return { consumer: c, matchedTag: c.meterNumber || c.accountNumber };
      }
      if (numOnly.length >= 3 && cleanText.includes(numOnly)) {
        return { consumer: c, matchedTag: c.meterNumber || c.meterSerial };
      }
    }

    return null;
  }
}
