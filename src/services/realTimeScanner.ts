import { Consumer } from '../types';

export interface RealTimeTagResult {
  matchedConsumer: Consumer | null;
  tagDetected: string;
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
   * Real-time frame extraction for tag detection.
   * STRICT: ONLY returns a match if the detector recognizes text that accurately matches
   * an existing meter tag, serial number, or account number. NO RANDOM GUESSING.
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
    
    // Scale for frame inspection
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    // Browser Native TextDetector API
    const detector = this.getTextDetector();
    if (detector) {
      try {
        const detectedTexts = await detector.detect(canvas);
        if (detectedTexts && detectedTexts.length > 0) {
          for (const item of detectedTexts) {
            const rawVal = (item.rawValue || '').trim().toUpperCase();
            if (!rawVal || rawVal.length < 3) continue;

            const match = this.findMatchingConsumer(rawVal, allConsumers);
            if (match) {
              return {
                matchedConsumer: match.consumer,
                tagDetected: match.matchedTag,
                confidence: 0.96,
                source: 'native_text_detector',
              };
            }
          }
        }
      } catch {
        // Silent catch for live detector
      }
    }

    // STRICT: If no verified text match was found, return null. Never guess!
    return null;
  }

  /**
   * Real-time frame extraction for mechanical dial reading.
   * STRICT: ONLY returns a reading if actual digits (4 to 6 continuous numbers)
   * are detected by the browser text engine. NO FABRICATED OR SIMULATED NUMBERS.
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
    
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    // Crop center 50% where the odometer reticle is located
    const cropX = Math.floor(vw * 0.2);
    const cropY = Math.floor(vh * 0.3);
    const cropW = Math.floor(vw * 0.6);
    const cropH = Math.floor(vh * 0.4);

    ctx.drawImage(videoElement, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);

    // Try Browser Native TextDetector for genuine digits
    const detector = this.getTextDetector();
    if (detector) {
      try {
        const detectedTexts = await detector.detect(canvas);
        if (detectedTexts && detectedTexts.length > 0) {
          for (const item of detectedTexts) {
            const rawVal = (item.rawValue || '').replace(/[^0-9]/g, '');
            // Only accept if exactly 4, 5, or 6 continuous digits are read
            if (rawVal.length >= 4 && rawVal.length <= 6) {
              const numVal = parseInt(rawVal, 10);
              if (!isNaN(numVal) && numVal >= 0) {
                const formatted = String(numVal).padStart(5, '0');
                return {
                  readingValue: numVal,
                  formatted5Digits: formatted,
                  digits: formatted.split(''),
                  confidence: 0.94,
                  source: 'native_text_detector',
                };
              }
            }
          }
        }
      } catch {
        // Fallback
      }
    }

    // STRICT: Return null if no real digits are read. Never fabricate numbers!
    return null;
  }

  /**
   * Helper: Strictly matches detected text string against consumer tags, meter numbers, or account numbers.
   * Requires exact token equality or strong prefix/suffix match (minimum 3 alphanumeric chars).
   */
  private static findMatchingConsumer(
    text: string,
    allConsumers: Consumer[]
  ): { consumer: Consumer; matchedTag: string } | null {
    const cleanText = text.trim().toUpperCase().replace(/[\s\-_]/g, '');
    if (cleanText.length < 3) return null;

    for (const c of allConsumers) {
      const tag = (c.meterNumber || '').toUpperCase().replace(/[\s\-_]/g, '');
      const serial = (c.meterSerial || '').toUpperCase().replace(/[\s\-_]/g, '');
      const acc = (c.accountNumber || '').toUpperCase().replace(/[\s\-_]/g, '');

      // Check for exact equality or substantial match (minimum 4 characters)
      if (tag.length >= 3 && (cleanText === tag || (tag.length >= 4 && cleanText.includes(tag)) || (cleanText.length >= 4 && tag.includes(cleanText)))) {
        return { consumer: c, matchedTag: c.meterNumber || c.meterSerial };
      }
      if (serial.length >= 3 && (cleanText === serial || (serial.length >= 4 && cleanText.includes(serial)) || (cleanText.length >= 4 && serial.includes(cleanText)))) {
        return { consumer: c, matchedTag: c.meterSerial || c.meterNumber };
      }
      if (acc.length >= 3 && (cleanText === acc || (acc.length >= 4 && cleanText.includes(acc)))) {
        return { consumer: c, matchedTag: c.meterNumber || c.accountNumber };
      }
    }

    return null;
  }
}
