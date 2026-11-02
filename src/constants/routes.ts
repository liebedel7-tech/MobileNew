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
 * Calculates the occupancy of all Tagoloan barangays based on current active meter readers.
 * If `excludeReaderId` is provided (e.g. when an existing reader or admin is editing their own routes),
 * that reader's current assignments will not count as occupied by someone else.
 */
export function calculateLocationOccupancies(
  readers: Array<ReaderAccount | StaffUser>,
  excludeReaderId?: string
): LocationOccupancy[] {
  // Filter for active readers (or readers with assigned routes)
  const activeReaders = (readers || []).filter((r) => {
    if (!r) return false;
    const rId = (r.id || '').toLowerCase();
    const rEmpId = (r.employeeId || '').toLowerCase();
    const rUname = (r.username || '').toLowerCase();
    const targetEx = (excludeReaderId || '').toLowerCase();

    if (targetEx && (rId === targetEx || rEmpId === targetEx || rUname === targetEx)) {
      return false; // exclude self
    }

    // Only active readers occupy locations
    const status = (r.status || 'active').toLowerCase();
    return status === 'active';
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
  if (allowed.some((r) => r.toLowerCase() === 'all' || r.toLowerCase() === 'all tagoloan districts')) {
    return true;
  }

  const cleanBrgy = cleanRouteString(consumer.barangay || '');
  const cleanRoute = cleanRouteString(consumer.routeCode || '');
  const cleanAddr = cleanRouteString(consumer.address || '');

  // Tagoloan 3-letter route code and name mappings
  const CODE_MAP: Record<string, string[]> = {
    poblacion: ['pob', 'rtpob'],
    baluarte: ['bal', 'rtbal'],
    casinglot: ['cas', 'rtcas'],
    mohon: ['moh', 'rtmoh'],
    natumolan: ['nat', 'rtnat'],
    stacruz: ['scz', 'stc', 'rtscz', 'rtstc', 'santacruz'],
    staana: ['sna', 'sta', 'rtsna', 'rtsta', 'santaana'],
    sugbongcogon: ['sug', 'rtsug'],
    gracia: ['gra', 'rtgra'],
    rosario: ['ros', 'rtros'],
  };

  return allowed.some((rawTarget) => {
    const target = cleanRouteString(rawTarget);
    if (!target) return false;

    // 1. Direct contains check
    if (cleanBrgy === target || cleanBrgy.includes(target) || target.includes(cleanBrgy)) return true;
    if (cleanRoute === target || cleanRoute.includes(target)) return true;
    if (cleanAddr.includes(target)) return true;

    // 2. Check route code abbreviation mapping
    for (const [key, codes] of Object.entries(CODE_MAP)) {
      // If target matches this barangay name
      if (target === key || target.includes(key) || key.includes(target)) {
        if (cleanBrgy.includes(key) || codes.some((c) => cleanRoute.includes(c) || cleanAddr.includes(c))) {
          return true;
        }
      }
      // If target matches one of the abbreviations
      if (codes.includes(target)) {
        if (cleanBrgy.includes(key) || cleanRoute.includes(target) || cleanAddr.includes(key)) {
          return true;
        }
      }
    }

    return false;
  });
}

/**
 * Consumer Route Sync & Admin ID Issuance Validation:
 * Consumers are strictly withheld from mobile sync until an Administrator has officially approved the account
 * and issued both an Account Number (e.g. 011-102-056) and a Meter Serial Number (e.g. 150307143).
 *
 * In addition, when an Admin deactivates an account or changes its status to not active (e.g., Inactive,
 * Disconnected, Blocked, Archived) OR when the associated water meter in the Water Meters module is marked
 * as Inactive, Damaged, Under Maintenance, or Unassigned, that consumer is strictly NOT available for field readings.
 */
export function isConsumerAccountIssued(c: any): boolean {
  if (!c) return false;
  const acct = (c.accountNumber || '').toString().trim();
  const meter = (c.meterNumber || c.meterSerial || '').toString().trim();

  const hasValidAccount = Boolean(
    acct !== '' && 
    !acct.toUpperCase().startsWith('PENDING') && 
    acct.toUpperCase() !== 'UNISSUED'
  );

  const hasValidMeter = Boolean(
    meter !== '' && 
    !meter.toUpperCase().startsWith('PENDING') && 
    meter.toUpperCase() !== 'UNISSUED'
  );

  return hasValidAccount && hasValidMeter;
}

export function isValidatedForFieldReading(c: any): boolean {
  if (!c) return false;
  
  // 1. Must satisfy Admin ID Issuance Gate (Issued Account # and Meter Tag #)
  if (!isConsumerAccountIssued(c)) {
    return false;
  }

  // 2. Check Consumer Account Status
  // Only 'active' and 'reconnected' accounts are eligible for field meter readings.
  const status = (c.status || '').toString().trim().toLowerCase();
  const INACTIVE_CONSUMER_STATUSES = new Set([
    'inactive',
    'deactivated',
    'disconnected',
    'blocked',
    'archived',
    'disconnection notice',
    'disconnection_notice',
    'for inspection',
    'pending_approval',
    'pending',
    'pending_installation',
    'installation_not_scheduled',
  ]);

  if (INACTIVE_CONSUMER_STATUSES.has(status)) {
    return false;
  }

  // 3. Check Water Meter Operational Status from the Water Meters Module
  // If the physical water meter is marked inactive, damaged, under maintenance, or unassigned,
  // it is strictly NOT available for readings.
  const meterStatus = (c.meterStatus || c.waterMeterStatus || '').toString().trim().toLowerCase();
  const INACTIVE_METER_STATUSES = new Set([
    'inactive',
    'deactivated',
    'damaged',
    'maintenance',
    'under_maintenance',
    'under maintenance',
    'unassigned',
  ]);

  if (meterStatus && INACTIVE_METER_STATUSES.has(meterStatus)) {
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

