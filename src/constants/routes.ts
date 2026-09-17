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
