export type ConsumerCategory = 
  | 'Residential' 
  | 'Commercial A' 
  | 'Commercial B' 
  | 'Industrial' 
  | 'Institutional';

export type ConnectionStatus = 
  | 'Active' 
  | 'Disconnected' 
  | 'Reconnected' 
  | 'For Inspection' 
  | 'Inactive';

export type ReadingStatus = 
  | 'PENDING_SYNC' 
  | 'SYNCED' 
  | 'FAILED' 
  | 'DRAFT';

export type ReaderStatus = 'pending' | 'active' | 'rejected';

export type ApprovalStatus = 'pending_approval' | 'approved' | 'rejected';

export type MeterCondition = 
  | 'NORMAL' 
  | 'GLASS_FOGGED' 
  | 'STUCK_DIAL' 
  | 'DAMAGED' 
  | 'HIGH_CONSUMPTION' 
  | 'ZERO_CONSUMPTION' 
  | 'LEAK_SUSPECTED'
  | 'METER_TAMPERED'
  | 'NO_ACCESS';

export interface GPSLocation {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp?: string;
  addressName?: string;
}

export interface Consumer {
  id: string;
  accountNumber: string;
  name: string;
  address: string;
  barangay: string;
  meterSerial: string;
  meterNumber?: string; // Meter Tag Number (e.g., MT-4401)
  meterSize: string;
  category: ConsumerCategory;
  consumerType?: string;
  status: ConnectionStatus;
  previousReading: number;
  previousReadingDate: string;
  averageConsumption: number;
  rateCode: string;
  gpsCoordinates: GPSLocation;
  routeCode: string;
  sequenceNo: number;
  contactNumber?: string;
  lastSyncDate?: string;
  isReadThisMonth?: boolean;
  currentMonthReading?: MeterReading;
}

export interface BillCalculation {
  consumption: number;
  minimumCharge: number;
  commodityCharge: number;
  breakdown: Array<{
    bracket: string;
    cuM: number;
    ratePerCuM: number;
    amount: number;
  }>;
  subTotal: number;
  environmentalFee: number; // 5%
  franchiseTax: number; // 2%
  maintenanceFee: number;
  seniorDiscount: number;
  totalAmountDue: number;
  penaltyAfterDue: number;
  grossAmountAfterDue: number;
  billingPeriod: string;
  dueDate: string;
  disconnectionDate: string;
}

export interface MeterReading {
  id: string;
  consumerId: string;
  accountNumber: string;
  consumerName: string;
  meterSerial: string;
  meterNumber?: string;
  category: ConsumerCategory;
  barangay: string;
  routeCode: string;
  previousReading: number;
  currentReading: number;
  consumption: number;
  readingDate: string;
  readingTime: string;
  readerId: string;
  readerName: string;
  gpsCoordinates: GPSLocation;
  photoUrl?: string;
  ocrConfidence?: number;
  ocrDetectedSerial?: string;
  meterCondition: MeterCondition;
  remarks?: string;
  status: ReadingStatus;
  approvalStatus?: ApprovalStatus;
  approvedAt?: string;
  approvedBy?: string;
  billCalculation: BillCalculation;
  batchId?: string;
  syncTimestamp?: string;
  serverReceiptId?: string;
  isAnomaly?: boolean;
  anomalyFlag?: boolean;
  anomalyReason?: string;
}

export interface ReaderAccount {
  id: string;
  employeeId: string;
  name: string;
  username: string;
  pin?: string;
  contactNumber: string;
  email?: string;
  assignedRoutes: string[]; // e.g. ['Poblacion', 'Natumolan', 'Baluarte']
  status: ReaderStatus;
  deviceInfo?: string;
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
}

export interface StaffUser {
  id: string;
  username: string;
  name: string;
  role: string;
  zone: string;
  employeeId?: string;
  assignedRoutes?: string[];
  status?: ReaderStatus;
  avatar?: string;
  token?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  userId: string;
  userName: string;
  details: string;
  deviceInfo?: string;
}

export interface SyncState {
  isOnline: boolean;
  isSimulatedOffline: boolean;
  lastSyncTime: string | null;
  syncInProgress: boolean;
  pendingCount: number;
  autoSyncInterval: number; // in seconds (e.g., 30 or 300)
  autoSyncEnabled: boolean;
  lastSyncMessage: string;
  failedCount: number;
}

export interface AppConfig {
  serverBaseUrl: string;
  apiTimeoutMs: number;
  districtName: string;
  districtCode: string;
  readingCycle: string;
  currentBillingMonth: string;
  requireGPS: boolean;
  requirePhotoOnHighConsumption: boolean;
  highConsumptionThresholdMultiplier: number;
  debugMode: boolean;
}

export type ActiveScreen = 
  | 'landing'
  | 'login'
  | 'dashboard'
  | 'consumers'
  | 'consumer_details'
  | 'reading_entry'
  | 'scan_meter'
  | 'batch_submission'
  | 'history'
  | 'audit_log'
  | 'meter_readers'
  | 'debug'
  | 'flutter_config'
  | 'token_setup'; // Backwards-compatible alias
