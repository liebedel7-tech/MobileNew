export interface ReaderModel {
  id: string;
  employeeId: string;
  username: string;
  pin: string;
  name: string;
  role: string;
  contactNumber: string;
  email: string;
  assignedRoutes: string[];
  status: 'pending' | 'active' | 'rejected' | 'terminated';
  employmentStatus: 'pending' | 'active' | 'rejected' | 'terminated';
  deviceInfo?: string;
  createdAt: string;
}

export interface AuditLogModel {
  id: string;
  action: string;
  performedBy: string;
  details: string;
  timestamp: string;
}

export interface BillingComputationResult {
  consumption: number;
  minimumCharge: number;
  tier1Amount: number;
  tier2Amount: number;
  tier3Amount: number;
  totalAmount: number;
  dueDate: string;
  rateCategory: string;
}
