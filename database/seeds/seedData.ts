/**
 * Tagoloan Water District (WDT) - Database Seed Records
 * Contains default accounts, meters, assigned routes, and rate benchmarks.
 */

export interface DistrictConsumer {
  id: string;
  accountNumber: string;
  name: string;
  address: string;
  barangay: string;
  meterSerial: string;
  meterNumber?: string;
  meterSize: string;
  category: string;
  status: string;
  previousReading: number;
  previousReadingDate: string;
  previousConsumption?: number;
  averageConsumption: number;
  rateCode: string;
  gpsCoordinates: { lat: number; lng: number };
  routeCode: string;
  sequenceNo: number;
  contactNumber: string;
  lastSyncDate: string;
}

export interface DistrictReader {
  id: string;
  employeeId: string;
  username: string;
  pin: string;
  name: string;
  role: string;
  contactNumber: string;
  email: string;
  assignedRoutes: string[];
  status: 'pending' | 'active' | 'rejected';
  employmentStatus: 'pending' | 'active' | 'rejected';
  deviceInfo?: string;
  createdAt: string;
}

export interface WaterDistrictReading {
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

// Re-export seed records from existing data pool
export { INITIAL_CONSUMERS, INITIAL_READERS } from '@/src/data/seedData';
