import { MeterRecognitionEngine, RecognitionResult, CropRegion } from './meterRecognitionEngine';
import { universalApiFetch, getApiEndpoint } from './apiConfig';
import { formatOdometerReading } from '../constants/routes';

export interface OCRResult {
  success: boolean;
  status: 'SUCCESS' | 'REJECTED_NO_5_DIGITS' | 'REJECTED_INVALID_READING' | 'REJECTED_AMBIGUOUS_MULTIPLE' | 'REJECTED_BLURRY' | 'FAIL_SAFE_MANUAL_REQUIRED';
  readingValue: number;
  odometerFormatted: string;
  confidence: number;
  digits: string[];
  meterSerialDetected?: string;
  meterCondition?: string;
  potentialLeak?: boolean;
  notes?: string;
  source: string;
  message?: string;
}

export interface TagOCRResult {
  success: boolean;
  tagDetected?: string;
  entitiesDetected?: string[];
  confidence: number;
  message?: string;
  notes?: string;
  source?: string;
}

export class OCRService {
  /**
   * Captures an image snapshot from an HTML5 video stream and returns base64 data URL
   */
  static captureFrameFromVideo(videoElement: HTMLVideoElement): string {
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth || 1280;
    canvas.height = videoElement.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.9);
    }
    return '';
  }

  /**
   * Client-side fallback analyzer using browser native TextDetector if available
   */
  private static async clientDetectDigits(imageBase64: string, previousReading: number = 0): Promise<number | null> {
    if (typeof window === 'undefined' || !(window as any).TextDetector) return null;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = async () => {
        try {
          const detector = new (window as any).TextDetector();
          const detected = await detector.detect(img);
          if (detected && detected.length > 0) {
            for (const item of detected) {
              const raw = (item.rawValue || '').trim();
              if (/[a-zA-Z#$\-_/\\~`!@%^&*+=()[\]{}|:;"'<>,.?]/.test(raw)) continue;
              const digits = raw.replace(/\s+/g, '');
              if (/^\d{5}$/.test(digits)) {
                const val = parseInt(digits, 10);
                if (!isNaN(val) && (previousReading === 0 || val >= previousReading || (previousReading >= 90000 && val < 10000))) {
                  resolve(val);
                  return;
                }
              }
            }
          }
        } catch {}
        resolve(null);
      };
      img.onerror = () => resolve(null);
      img.src = imageBase64;
    });
  }

  /**
   * Identifies the physical meter Tag Number / Serial Number and all visible entities from camera photo
   */
  static async analyzeTagPhoto(imageBase64: string): Promise<TagOCRResult> {
    try {
      const response = await universalApiFetch('/api/ocr/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          mode: 'tag',
        }),
      });

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        if (data && data.success && data.tagDetected && !data.isOfflineFallback) {
          const tag = String(data.tagDetected).trim();
          const entities: string[] = Array.isArray(data.entitiesDetected) && data.entitiesDetected.length > 0
            ? data.entitiesDetected
            : [tag];

          return {
            success: true,
            tagDetected: tag,
            entitiesDetected: entities,
            confidence: data.confidence || 0.95,
            message: `Identified Meter Tag: ${tag}`,
            notes: data.notes || 'Identified from meter badge.',
            source: data.source || 'server_ocr',
          };
        }
      }
    } catch (err) {
      console.warn('Tag recognition error:', err);
    }

    return {
      success: false,
      tagDetected: undefined,
      entitiesDetected: [],
      confidence: 0,
      message: 'Offline Mode: Frame the meter badge or select the consumer account directly below.',
      source: 'offline_client',
    };
  }

  /**
   * Analyzes the real captured meter photo via Vision OCR for 5-digit reading ONLY
   * In offline field conditions, falls back to client OCR or instant manual confirmation with attached photo.
   */
  static async analyzeMeterPhoto(
    imageBase64: string,
    previousReading?: number,
    meterSerial?: string
  ): Promise<OCRResult> {
    const prev = previousReading || 0;
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    // 1. Try server OCR if online
    if (!isOffline) {
      try {
        const response = await universalApiFetch('/api/ocr/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64,
            mode: 'reading',
            previousReading: prev,
            meterSerial: meterSerial || '',
          }),
        });

        if (response.ok) {
          const data = await response.json().catch(() => ({}));
          
          if (data && data.success && data.readingValue !== null && data.readingValue !== undefined && !data.isOfflineFallback) {
            const rawVal = String(data.readingValue).replace(/\D/g, '').slice(0, 5);
            const readingVal = Math.min(99999, Math.max(0, parseInt(rawVal, 10) || 0));
            const formatted5 = String(readingVal).padStart(5, '0');
            return {
              success: true,
              status: 'SUCCESS',
              readingValue: readingVal,
              odometerFormatted: formatted5,
              confidence: data.confidence || 0.95,
              digits: formatted5.split(''),
              meterSerialDetected: data.meterSerialDetected || meterSerial || '',
              meterCondition: data.meterCondition || 'Normal',
              potentialLeak: !!data.potentialLeak,
              notes: data.notes || 'Identified from camera image.',
              source: 'camera_vision_ocr',
              message: `Detected reading: ${formatted5} cu.m.`,
            };
          }

          // If server returned valid rejection from image (e.g. blurry / invalid)
          if (data && data.status === 'REJECTED_INVALID_READING') {
            return {
              success: false,
              status: 'REJECTED_INVALID_READING',
              readingValue: 0,
              odometerFormatted: '-----',
              confidence: 0,
              digits: ['-', '-', '-', '-', '-'],
              meterSerialDetected: meterSerial || '',
              meterCondition: 'Invalid Reading',
              potentialLeak: false,
              notes: data.notes || 'Reading less than baseline.',
              source: 'camera_vision_ocr',
              message: data.message || `Detected reading is less than previous record (${formatOdometerReading(prev)} cu.m.). Please check meter.`,
            };
          }
        }
      } catch (err) {
        console.warn('Camera OCR recognition network note:', err);
      }
    }

    // 2. Client-Side Offline Detection (Native TextDetector if available)
    try {
      const clientVal = await this.clientDetectDigits(imageBase64, prev);
      if (clientVal !== null) {
        const formatted5 = formatOdometerReading(clientVal);
        return {
          success: true,
          status: 'SUCCESS',
          readingValue: clientVal,
          odometerFormatted: formatted5,
          confidence: 0.94,
          digits: formatted5.split(''),
          meterSerialDetected: meterSerial || '',
          meterCondition: 'Normal',
          potentialLeak: false,
          notes: 'Identified via device optical vision sensor.',
          source: 'device_optical_ocr',
          message: `Auto-identified: ${formatted5} cu.m. (Offline Optical Vision)`,
        };
      }
    } catch {}

    // 3. Resilient Offline Snapshot Mode: Photo is captured; presents the 5 odometer dials for reader confirmation
    const formattedBaseline = formatOdometerReading(prev);
    return {
      success: true,
      status: 'FAIL_SAFE_MANUAL_REQUIRED',
      readingValue: prev,
      odometerFormatted: formattedBaseline,
      confidence: 0.85,
      digits: formattedBaseline.split(''),
      meterSerialDetected: meterSerial || '',
      meterCondition: 'Normal',
      potentialLeak: false,
      notes: 'Offline Mode: Snapshot captured. Please verify or adjust the 5 digits on the dial below.',
      source: 'offline_camera_snapshot',
      message: 'Offline Mode: Camera snapshot captured. Please confirm the 5 digits on the dial below.',
    };
  }
}

