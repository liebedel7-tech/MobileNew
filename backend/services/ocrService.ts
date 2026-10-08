/**
 * Tagoloan Water District (WDT) - OCR Vision Service
 * Analyzes mechanical water meter rolling odometer dials using Gemini multimodal AI.
 */

import { GoogleGenAI } from '@google/genai';

export class OcrService {
  public static async analyzeMeterPhoto(base64Image: string, meterSerial?: string) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const ai = new GoogleGenAI({});
    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `You are an expert utility meter reader OCR specialist inspecting a water meter dial from Tagoloan Water District.
Examine the image carefully. Identify the mechanical rolling odometer wheels showing the water consumption index in cubic meters (usually 4 to 6 digits, commonly 5 black digits).
Also identify any stamped serial number or badge on the meter body.

Return JSON in this exact format:
{
  "readingValue": 452,
  "odometerFormatted": "00452",
  "digits": ["0", "0", "4", "5", "2"],
  "confidence": 0.96,
  "meterSerialDetected": "MTR-8849201",
  "notes": "Clear dial reading"
}
If unreadable, return readingValue as null and confidence as 0.`,
            },
            {
              inlineData: {
                data: cleanBase64,
                mimeType: 'image/jpeg',
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '{}';
    return JSON.parse(text);
  }
}
