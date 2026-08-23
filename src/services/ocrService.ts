import { MeterRecognitionEngine, RecognitionResult, CropRegion } from './meterRecognitionEngine';
import { universalApiFetch, getApiEndpoint } from './apiConfig';

export interface OCRResult {
  success: boolean;
  status: 'SUCCESS' | 'REJECTED_NO_5_DIGITS' | 'REJECTED_AMBIGUOUS_MULTIPLE' | 'REJECTED_BLURRY' | 'FAIL_SAFE_MANUAL_REQUIRED';
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
   * Analyzes the real captured meter photo via Vision OCR
   */
  static async analyzeMeterPhoto(
    imageBase64: string,
    previousReading?: number,
    meterSerial?: string
  ): Promise<OCRResult> {
    try {
      const response = await universalApiFetch('/api/ocr/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          previousReading: previousReading || 0,
          meterSerial: meterSerial || '',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data && data.success && data.readingValue !== null && data.readingValue !== undefined) {
          const readingVal = Number(data.readingValue);
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

        // Vision returned rejection or unclear digits from the real photo
        return {
          success: false,
          status: (data.status as any) || 'REJECTED_NO_5_DIGITS',
          readingValue: 0,
          odometerFormatted: '-----',
          confidence: data.confidence || 0,
          digits: ['-', '-', '-', '-', '-'],
          meterSerialDetected: data.meterSerialDetected || '',
          meterCondition: data.meterCondition || 'Unclear',
          potentialLeak: false,
          notes: data.notes || 'Digits not clearly visible.',
          source: 'camera_vision_ocr',
          message: data.message || 'No clear 5-digit mechanical meter dial detected. Please retake photo with better lighting and alignment.',
        };
      }
    } catch (err) {
      console.warn('Camera OCR recognition error:', err);
    }

    // Authentic failure fallback (Never guess or mock fake +15 numbers)
    return {
      success: false,
      status: 'FAIL_SAFE_MANUAL_REQUIRED',
      readingValue: 0,
      odometerFormatted: '-----',
      confidence: 0,
      digits: ['-', '-', '-', '-', '-'],
      meterSerialDetected: meterSerial || '',
      meterCondition: 'Unclear',
      potentialLeak: false,
      notes: 'Please position camera steadily over the 5-digit dial or enter the reading directly.',
      source: 'camera_vision_ocr',
      message: 'Could not connect to image recognition service. You can enter the reading manually.',
    };
  }
}

