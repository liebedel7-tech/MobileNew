// Tagoloan Water District (WDT) Official Service Locations & Occupancy Helpers
import { ReaderAccount, StaffUser } from '../types';

export const TAGOLOAN_BARANGAYS = [
  'Poblacion',
  'Baluarte',
  'Casinglot',
  'Mohon',
  'Natumolan',
  'Sta. Cruz',
  'Sta. Ana',
  'Sugbongcogon',
  'Gracia',
  'Rosario',
] as const;

export type TagoloanBarangay = typeof TAGOLOAN_BARANGAYS[number];

export interface LocationOccupancy {
  location: string;
  isOccupied: boolean;
  assignedReaderName?: string;
  assignedReaderId?: string;
  assignedReaderEmployeeId?: string;
  assignedReaderRole?: string;
  status?: string;
}

/**
 * Normalizes location string for robust case-insensitive and space-insensitive matching.
 * e.g. "Sta. Cruz", "Sta Cruz", "sta cruz", "STACRUZ" -> "stacruz"
 */
export function normalizeLocationName(name: string): string {
  if (!name) return '';
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Compares two location names ignoring spaces, punctuation, and casing.
 */
export function areLocationsEqual(a: string, b: string): boolean {
  return normalizeLocationName(a) === normalizeLocationName(b);
}

/**
 * Checks if a meter reader account is deactivated, terminated, or inactive.
 * When mobile detects any deactivated account, its assigned routes are automatically freed.
 */
export function isReaderAccountDeactivated(r: any): boolean {
  if (!r) return true;
  const status = String(r.status || '').trim().toLowerCase();
  const empStatus = String(r.employmentStatus || '').trim().toLowerCase();
  const isTerminatedFlag = Boolean(r.isTerminated || r.isDeactivated);

  if (isTerminatedFlag) return true;

  const DEACTIVATED_STATUSES = new Set([
    'terminated',
    'inactive',
    'deactivated',
    'rejected',
    'suspended',
    'revoked',
    'disabled',
    'locked',
  ]);

  if (DEACTIVATED_STATUSES.has(status) || DEACTIVATED_STATUSES.has(empStatus)) {
    return true;
  }

  // Must have status === 'active' or employmentStatus === 'active'
  if (status !== 'active' && empStatus !== 'active') {
    return true;
  }

  return false;
}

/**
 * Calculates the occupancy of all Tagoloan barangays based on current active meter readers.
 * If `excludeReaderId` is provided (e.g. when an existing reader or admin is editing their own routes),
 * that reader's current assignments will not count as occupied by someone else.
 * 
 * AUTOMATIC AVAILABILITY RULE:
 * When an account is detected as deactivated, terminated, or inactive, its assigned area routes
 * automatically become unassigned, available, and open for other meter readers to register or claim.
 */
export function calculateLocationOccupancies(
  readers: Array<ReaderAccount | StaffUser>,
  excludeReaderId?: string
): LocationOccupancy[] {
  // Filter for active readers only. Any deactivated, terminated, or revoked accounts automatically release routes!
  const activeReaders = (readers || []).filter((r) => {
    if (!r) return false;
    const rId = (r.id || '').toLowerCase();
    const rEmpId = (r.employeeId || '').toLowerCase();
    const rUname = (r.username || '').toLowerCase();
    const targetEx = (excludeReaderId || '').toLowerCase();

    if (targetEx && (rId === targetEx || rEmpId === targetEx || rUname === targetEx)) {
      return false; // exclude self
    }

    // If mobile detects a deactivated or terminated account, its area route is automatically released and available!
    if (isReaderAccountDeactivated(r)) {
      return false;
    }

    return true;
  });

  return TAGOLOAN_BARANGAYS.map((barangay) => {
    const normBarangay = normalizeLocationName(barangay);

    // Find if any active reader is assigned to this location
    const occupyingReader = activeReaders.find((reader) => {
      const routes = reader.assignedRoutes || ((reader as any).zone ? [(reader as any).zone] : []);
      return routes.some((rt) => normalizeLocationName(rt) === normBarangay);
    });

    if (occupyingReader) {
      return {
        location: barangay,
        isOccupied: true,
        assignedReaderName: occupyingReader.name,
        assignedReaderId: occupyingReader.id,
        assignedReaderEmployeeId: occupyingReader.employeeId,
        assignedReaderRole: (occupyingReader as any).role || 'Meter Reader',
        status: occupyingReader.status,
      };
    }

    return {
      location: barangay,
      isOccupied: false,
    };
  });
}

/**
 * Checks if a specific location is currently occupied by an active reader.
 */
export function checkIsLocationOccupied(
  location: string,
  readers: Array<ReaderAccount | StaffUser>,
  excludeReaderId?: string
): { isOccupied: boolean; assignedReaderName?: string } {
  const occupancies = calculateLocationOccupancies(readers, excludeReaderId);
  const matched = occupancies.find((o) => areLocationsEqual(o.location, location));
  if (matched && matched.isOccupied) {
    return {
      isOccupied: true,
      assignedReaderName: matched.assignedReaderName,
    };
  }
  return { isOccupied: false };
}

/**
 * Normalizes text for barangay / route code matching by handling aliases like 'santa' vs 'sta.'
 */
function cleanRouteString(s: string): string {
  if (!s) return '';
  return s
    .toLowerCase()
    .replace(/santa\s+/g, 'sta. ')
    .replace(/santa/g, 'sta')
    .replace(/brgy\.?\s*/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Canonical route & area isolation validator:
 * Verifies if a given consumer belongs to the meter reader's assigned areas/routes.
 * Supports single or multiple assigned areas, route codes, and barangay aliases.
 */
const BRGY_CANONICAL: Record<string, { brgy: string; id: string; prefix: string }> = {
  poblacion: { brgy: 'poblacion', id: 'brg01', prefix: 'rtpob' },
  natumolan: { brgy: 'natumolan', id: 'brg02', prefix: 'rtnat' },
  baluarte: { brgy: 'baluarte', id: 'brg03', prefix: 'rtbal' },
  staana: { brgy: 'staana', id: 'brg04', prefix: 'rtsna' },
  stacruz: { brgy: 'stacruz', id: 'brg05', prefix: 'rtscz' },
  mohon: { brgy: 'mohon', id: 'brg06', prefix: 'rtmoh' },
  gracia: { brgy: 'gracia', id: 'brg07', prefix: 'rtgra' },
  casinglot: { brgy: 'casinglot', id: 'brg08', prefix: 'rtcas' },
  sugbongcogon: { brgy: 'sugbongcogon', id: 'brg09', prefix: 'rtsug' },
  rosario: { brgy: 'rosario', id: 'brg10', prefix: 'rtros' },
};

export function isConsumerInAssignedAreas(
  consumer: any,
  assignedRoutes?: string[] | string | null
): boolean {
  if (!consumer) return false;
  if (!assignedRoutes) return false;

  const list = Array.isArray(assignedRoutes) ? assignedRoutes : assignedRoutes.split(',');
  const allowed = list.map((r) => r.trim()).filter(Boolean);

  if (allowed.length === 0) return false;

  // If explicit admin 'all' is requested
  if (allowed.some((r) => r.toLowerCase() === 'all' || r.toLowerCase() === 'all tagoloan districts' || r === '*')) {
    return true;
  }

  const cBrgy = cleanRouteString(consumer.barangay || '');
  const cBrgyId = cleanRouteString(consumer.barangayId || '');
  const cRoute = cleanRouteString(consumer.routeCode || '');
  const cSitio = cleanRouteString(consumer.sitioZone || '');
  const cAddr = cleanRouteString(consumer.address || '');

  return allowed.some((rawTarget) => {
    if (!rawTarget) return false;
    const target = cleanRouteString(rawTarget.replace(/^zone\s*[\d-]+\s*:\s*/i, ''));
    if (!target) return false;

    if (target === 'all' || target === '*') return true;

    // 1. Direct barangay equality or full inclusion
    if (cBrgy && (cBrgy === target || (target.length >= 4 && cBrgy.includes(target)))) {
      return true;
    }

    // 2. Canonical mapping for Tagoloan official barangays
    for (const [key, meta] of Object.entries(BRGY_CANONICAL)) {
      if (target === key || (target.length >= 4 && key.includes(target))) {
        if (cBrgy === meta.brgy) return true;
        if (cBrgyId === meta.id) return true;
        if (cRoute.startsWith(meta.prefix)) return true;
      }
    }

    // 3. Specific route code or sitio matches
    if (cRoute && cRoute === target) return true;
    if (cSitio && (cSitio === target || (target.length >= 5 && cSitio.includes(target)))) return true;
    if (cBrgyId && cBrgyId === target) return true;

    // 4. Fallback if consumer has no barangay specified
    if (!cBrgy && cAddr && target.length >= 5 && cAddr.includes(target)) {
      return true;
    }

    return false;
  });
}

/**
 * Consumer Route Sync & Admin ID Issuance Validation:
 * Consumers are strictly verified to ensure both Account Number and Meter Tag Number are present.
 * Any account starting with PENDING or unassigned is not issued.
 */
export function isConsumerAccountIssued(c: any): boolean {
  if (!c) return false;
  const acct = (c.accountNumber || '').toString().trim().toUpperCase();
  const meter = (c.meterNumber || c.meterSerial || '').toString().trim().toUpperCase();

  const hasValidAccount = Boolean(
    acct !== '' && 
    !acct.startsWith('PENDING') && 
    acct !== 'UNISSUED' &&
    acct !== 'UNASSIGNED' &&
    acct !== 'PENDING ADMIN ISSUANCE'
  );

  const hasValidMeter = Boolean(
    meter !== '' && 
    !meter.startsWith('PENDING') && 
    meter !== 'UNISSUED' &&
    meter !== 'UNASSIGNED'
  );

  return hasValidAccount && hasValidMeter;
}

export function isValidatedForFieldReading(c: any): boolean {
  if (!c) return false;
  
  // 1. Must satisfy Admin ID Issuance Gate (Issued Account # and Tag Number / Meter Serial)
  if (!isConsumerAccountIssued(c)) {
    return false;
  }

  // 2. Check Consumer Account Status: must not be a pending applicant or installation
  const status = (c.status || '').toString().trim().toLowerCase();
  const PENDING_STATUSES = new Set([
    'pending_approval',
    'pending',
    'pending_installation',
    'installation_not_scheduled',
  ]);

  if (PENDING_STATUSES.has(status)) {
    return false;
  }

  // 3. Physical meter operational status: if marked damaged or under maintenance, reader cannot read
  const meterStatus = (c.meterStatus || c.waterMeterStatus || '').toString().trim().toLowerCase();
  if (meterStatus === 'damaged' || meterStatus === 'maintenance' || meterStatus === 'under_maintenance') {
    return false;
  }

  return true;
}

/**
 * Returns a human-friendly explanation of why a consumer is not available for field reading.
 */
export function getConsumerDeactivationReason(c: any): string | null {
  if (!c) return 'Consumer record not found';
  
  if (!isConsumerAccountIssued(c)) {
    return 'Awaiting Admin ID Issuance: Account Number and Tag Number not yet issued.';
  }

  const meterStatus = (c.meterStatus || c.waterMeterStatus || '').toString().trim().toLowerCase();
  if (meterStatus === 'damaged' || meterStatus === 'faulty') {
    return 'Water Meter marked as DAMAGED by Central Admin in Water Meters module.';
  }
  if (meterStatus === 'maintenance' || meterStatus === 'under_maintenance' || meterStatus === 'under maintenance') {
    return 'Water Meter marked UNDER MAINTENANCE by Central Admin in Water Meters module.';
  }
  if (meterStatus === 'inactive' || meterStatus === 'deactivated') {
    return 'Water Meter deactivated (INACTIVE) by Central Admin in Water Meters module.';
  }
  if (meterStatus === 'unassigned') {
    return 'Water Meter is UNASSIGNED in Water Meters hardware inventory.';
  }

  const status = (c.status || '').toString().trim().toLowerCase();
  if (status === 'inactive' || status === 'deactivated') {
    return 'Consumer Account marked INACTIVE / DEACTIVATED by Central Admin.';
  }
  if (status === 'disconnected') {
    return 'Water Service DISCONNECTED by Central Admin (Delinquency / Request).';
  }
  if (status === 'disconnection notice' || status === 'disconnection_notice') {
    return 'DISCONNECTION NOTICE issued by Central Admin. Pending settlement.';
  }
  if (status === 'blocked') {
    return 'Consumer Account BLOCKED by Central Admin.';
  }
  if (status === 'archived') {
    return 'Consumer Account ARCHIVED by Central Admin.';
  }
  if (status === 'for inspection') {
    return 'Account marked FOR INSPECTION by Central Admin.';
  }
  if (status === 'pending_approval' || status === 'pending' || status === 'pending_installation') {
    return 'Pending administrative approval / installation verification.';
  }

  return null;
}

/**
 * Formats a water meter reading into a strictly 5-digit whole-number odometer string from 00000 to 99999.
 * Water meter readings are whole numbers only and never contain decimal points or commas.
 */
export function formatOdometerReading(value: number | string | undefined | null): string {
  if (value === undefined || value === null || value === '') return '00000';
  const clean = String(value).replace(/\D/g, '');
  if (!clean) return '00000';
  const num = Math.min(99999, Math.max(0, parseInt(clean, 10) || 0));
  return String(num).padStart(5, '0');
}

/**
 * Cleans user input to strictly allow 5-digit whole numbers (00000 to 99999).
 * Strips decimal points (.), commas (,), negative signs (-), and all non-numeric characters.
 */
export function cleanOdometerInput(input: string): string {
  if (!input) return '';
  return input.replace(/\D/g, '').slice(0, 5);
}

/**
 * Parses an odometer reading into an integer between 0 and 99999.
 */
export function parseOdometerReading(input: number | string | undefined | null): number {
  if (typeof input === 'number') {
    if (isNaN(input)) return 0;
    return Math.min(99999, Math.max(0, Math.floor(input)));
  }
  const clean = cleanOdometerInput(String(input || ''));
  if (!clean) return 0;
  return Math.min(99999, Math.max(0, parseInt(clean, 10)));
}

