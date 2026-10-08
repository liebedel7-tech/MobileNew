export interface ConsumerModel {
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
