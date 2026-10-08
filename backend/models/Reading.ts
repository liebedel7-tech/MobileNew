export interface ReadingModel {
  id: string;
  accountNumber: string;
  consumerName: string;
  barangay: string;
  meterSerial: string;
  readerId: string;
  readerName: string;
  previousReading: number;
  currentReading: number;
  consumption: number;
  totalAmount: number;
  billingPeriod: string;
  readingDate: string;
  dueDate: string;
  readingMethod: 'MANUAL' | 'OCR_CAMERA' | 'BARCODE_LOOKUP';
  meterCondition: string;
  anomalyDetected: boolean;
  anomalyType?: string;
  photoEvidenceUrl?: string;
  gpsCoordinates?: { lat: number; lng: number };
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  isOfflineSync: boolean;
  syncedAt: string;
}
