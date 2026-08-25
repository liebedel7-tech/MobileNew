// Vercel Serverless Function: /api/consumers
import type { VercelRequest, VercelResponse } from '@vercel/node';

export const CONSUMERS = [
  {
    id: 'WDT-ACC-01042',
    accountNumber: '01-042-0091',
    name: 'AMORATO, VICENTE G.',
    address: 'Zone 2, Brgy. Poblacion, Tagoloan, Misamis Oriental',
    barangay: 'Poblacion',
    meterSerial: 'MTR-8849201',
    meterSize: '1/2"',
    category: 'Residential',
    status: 'Active',
    previousReading: 342,
    previousReadingDate: '2026-07-14',
    averageConsumption: 18,
    rateCode: 'RES-01',
    gpsCoordinates: { lat: 8.5398, lng: 124.7523 },
    routeCode: 'RT-POB-04',
    sequenceNo: 1,
    contactNumber: '+63 917 234 5678',
    lastSyncDate: '2026-08-01T08:00:00Z',
  },
  {
    id: 'WDT-ACC-01043',
    accountNumber: '01-042-0092',
    name: 'CABALLERO, MA. ELENA S.',
    address: 'Purok 4, Brgy. Baluarte, Tagoloan, Misamis Oriental',
    barangay: 'Baluarte',
    meterSerial: 'MTR-7738291',
    meterSize: '1/2"',
    category: 'Residential',
    status: 'Active',
    previousReading: 512,
    previousReadingDate: '2026-07-14',
    averageConsumption: 22,
    rateCode: 'RES-01',
    gpsCoordinates: { lat: 8.5462, lng: 124.7611 },
    routeCode: 'RT-BAL-01',
    sequenceNo: 2,
    contactNumber: '+63 928 891 2345',
    lastSyncDate: '2026-08-01T08:00:00Z',
  },
  {
    id: 'WDT-ACC-01044',
    accountNumber: '02-019-0115',
    name: 'TAGOLOAN GRAIN MILL & TRADING',
    address: 'National Highway, Brgy. Casinglot, Tagoloan',
    barangay: 'Casinglot',
    meterSerial: 'MTR-COM-44912',
    meterSize: '1"',
    category: 'Commercial A',
    status: 'Active',
    previousReading: 1289,
    previousReadingDate: '2026-07-13',
    averageConsumption: 85,
    rateCode: 'COM-A-01',
    gpsCoordinates: { lat: 8.5312, lng: 124.7435 },
    routeCode: 'RT-CAS-02',
    sequenceNo: 3,
    contactNumber: '+63 939 123 4567',
    lastSyncDate: '2026-08-01T08:00:00Z',
  },
  {
    id: 'WDT-ACC-01045',
    accountNumber: '01-088-0044',
    name: 'RODRIGUEZ, BENJAMIN T.',
    address: 'Zone 1, Brgy. Mohon, Tagoloan, Misamis Oriental',
    barangay: 'Mohon',
    meterSerial: 'MTR-9021844',
    meterSize: '1/2"',
    category: 'Residential',
    status: 'Active',
    previousReading: 198,
    previousReadingDate: '2026-07-15',
    averageConsumption: 14,
    rateCode: 'RES-01',
    gpsCoordinates: { lat: 8.5284, lng: 124.7698 },
    routeCode: 'RT-MOH-01',
    sequenceNo: 4,
    contactNumber: '+63 915 678 9012',
    lastSyncDate: '2026-08-01T08:00:00Z',
  },
  {
    id: 'WDT-ACC-01046',
    accountNumber: '03-005-0012',
    name: 'PHIVIDEC AGRO-INDUSTRIAL FABRICATION CORP.',
    address: 'Industrial Estate, Brgy. Sugbongcogon, Tagoloan',
    barangay: 'Sugbongcogon',
    meterSerial: 'MTR-IND-99102',
    meterSize: '2"',
    category: 'Industrial',
    status: 'Active',
    previousReading: 4890,
    previousReadingDate: '2026-07-12',
    averageConsumption: 340,
    rateCode: 'IND-01',
    gpsCoordinates: { lat: 8.5521, lng: 124.7388 },
    routeCode: 'RT-SUG-03',
    sequenceNo: 5,
    contactNumber: '+63 88 567 1122',
    lastSyncDate: '2026-08-01T08:00:00Z',
  },
  {
    id: 'WDT-ACC-01047',
    accountNumber: '01-012-0059',
    name: 'TAGOLOAN CENTRAL ELEMENTARY SCHOOL',
    address: 'School Site Rd, Brgy. Poblacion, Tagoloan',
    barangay: 'Poblacion',
    meterSerial: 'MTR-INST-1029',
    meterSize: '1"',
    category: 'Institutional',
    status: 'Active',
    previousReading: 875,
    previousReadingDate: '2026-07-14',
    averageConsumption: 60,
    rateCode: 'INST-01',
    gpsCoordinates: { lat: 8.5412, lng: 124.7541 },
    routeCode: 'RT-POB-01',
    sequenceNo: 6,
    contactNumber: '+63 88 567 9900',
    lastSyncDate: '2026-08-01T08:00:00Z',
  },
  {
    id: 'WDT-ACC-01048',
    accountNumber: '01-099-0128',
    name: 'VALDEZ, DANILO P.',
    address: 'Zone 3, Brgy. Natumolan, Tagoloan, Misamis Oriental',
    barangay: 'Natumolan',
    meterSerial: 'MTR-6638102',
    meterSize: '1/2"',
    category: 'Residential',
    status: 'Disconnected',
    previousReading: 410,
    previousReadingDate: '2026-07-10',
    averageConsumption: 16,
    rateCode: 'RES-01',
    gpsCoordinates: { lat: 8.5355, lng: 124.7602 },
    routeCode: 'RT-NAT-02',
    sequenceNo: 7,
    contactNumber: '+63 945 223 3445',
    lastSyncDate: '2026-08-01T08:00:00Z',
  },
  {
    id: 'WDT-ACC-01049',
    accountNumber: '01-042-0199',
    name: 'MACASARTE, ROLANDO E.',
    address: 'Sitio Gracia, Brgy. Gracia, Tagoloan, Misamis Oriental',
    barangay: 'Gracia',
    meterSerial: 'MTR-4481093',
    meterSize: '1/2"',
    category: 'Residential',
    status: 'Active',
    previousReading: 680,
    previousReadingDate: '2026-07-14',
    averageConsumption: 24,
    rateCode: 'RES-01',
    gpsCoordinates: { lat: 8.5204, lng: 124.7731 },
    routeCode: 'RT-GRA-01',
    sequenceNo: 8,
    contactNumber: '+63 977 441 9923',
    lastSyncDate: '2026-08-01T08:00:00Z',
  },
  {
    id: 'WDT-ACC-01050',
    accountNumber: '01-073-0041',
    name: 'LUMANGCAS, CORAZON B.',
    address: 'Purok 2, Brgy. Sta. Cruz, Tagoloan, Misamis Oriental',
    barangay: 'Sta. Cruz',
    meterSerial: 'MTR-5529011',
    meterSize: '1/2"',
    category: 'Residential',
    status: 'Active',
    previousReading: 295,
    previousReadingDate: '2026-07-15',
    averageConsumption: 19,
    rateCode: 'RES-01',
    gpsCoordinates: { lat: 8.5441, lng: 124.7489 },
    routeCode: 'RT-SCZ-01',
    sequenceNo: 9,
    contactNumber: '+63 908 554 1234',
    lastSyncDate: '2026-08-01T08:00:00Z',
  },
  {
    id: 'WDT-ACC-01051',
    accountNumber: '02-088-0311',
    name: 'SEAFOODS RESTO & BAKERY',
    address: 'Tagoloan Commercial Arcade, Brgy. Poblacion',
    barangay: 'Poblacion',
    meterSerial: 'MTR-COM-88319',
    meterSize: '3/4"',
    category: 'Commercial B',
    status: 'Active',
    previousReading: 914,
    previousReadingDate: '2026-07-14',
    averageConsumption: 48,
    rateCode: 'COM-B-01',
    gpsCoordinates: { lat: 8.5401, lng: 124.7533 },
    routeCode: 'RT-POB-02',
    sequenceNo: 10,
    contactNumber: '+63 921 777 8899',
    lastSyncDate: '2026-08-01T08:00:00Z',
  },
  {
    id: 'WDT-ACC-01052',
    accountNumber: '01-061-0083',
    name: 'QUILATON, EDGARDO M.',
    address: 'Zone 5, Brgy. Sta. Ana, Tagoloan, Misamis Oriental',
    barangay: 'Sta. Ana',
    meterSerial: 'MTR-1192837',
    meterSize: '1/2"',
    category: 'Residential',
    status: 'Active',
    previousReading: 432,
    previousReadingDate: '2026-07-13',
    averageConsumption: 21,
    rateCode: 'RES-01',
    gpsCoordinates: { lat: 8.5199, lng: 124.7812 },
    routeCode: 'RT-SNA-01',
    sequenceNo: 11,
    contactNumber: '+63 966 332 1198',
    lastSyncDate: '2026-08-01T08:00:00Z',
  },
  {
    id: 'WDT-ACC-01053',
    accountNumber: '01-042-0310',
    name: 'YAP, FORTUNATO L.',
    address: 'Purok 3, Brgy. Poblacion, Tagoloan, Misamis Oriental',
    barangay: 'Poblacion',
    meterSerial: 'MTR-3392019',
    meterSize: '1/2"',
    category: 'Residential',
    status: 'Active',
    previousReading: 815,
    previousReadingDate: '2026-07-14',
    averageConsumption: 25,
    rateCode: 'RES-01',
    gpsCoordinates: { lat: 8.5405, lng: 124.7518 },
    routeCode: 'RT-POB-04',
    sequenceNo: 12,
    contactNumber: '+63 917 881 2233',
    lastSyncDate: '2026-08-01T08:00:00Z',
  },
];

export default function handler(req: VercelRequest | any, res: VercelResponse | any) {
  // CORS Headers
  if (typeof res.setHeader === 'function') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
  }

  if (req.method === 'OPTIONS') {
    if (typeof res.status === 'function') return res.status(200).end();
    res.statusCode = 200;
    return res.end();
  }

  try {
    const query = req.query || {};
    const { zone, barangay, route, search, q, status, category } = query;
    let filtered = [...CONSUMERS];

    const searchTerm = (search || q || '') as string;
    if (searchTerm && typeof searchTerm === 'string' && searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(c =>
        (c.name && c.name.toLowerCase().includes(term)) ||
        (c.accountNumber && c.accountNumber.toLowerCase().includes(term)) ||
        (c.meterSerial && c.meterSerial.toLowerCase().includes(term)) ||
        (c.address && c.address.toLowerCase().includes(term)) ||
        (c.barangay && c.barangay.toLowerCase().includes(term))
      );
    }

    const zoneFilter = (zone || barangay) as string;
    if (zoneFilter && typeof zoneFilter === 'string' && zoneFilter.toLowerCase() !== 'all') {
      const z = zoneFilter.toLowerCase();
      filtered = filtered.filter(c => 
        (c.barangay && c.barangay.toLowerCase().includes(z)) ||
        (c.routeCode && c.routeCode.toLowerCase().includes(z)) ||
        (c.address && c.address.toLowerCase().includes(z))
      );
    }

    if (route && typeof route === 'string' && route.toLowerCase() !== 'all') {
      filtered = filtered.filter(c => c.routeCode && c.routeCode.toLowerCase().includes(route.toLowerCase()));
    }

    if (status && typeof status === 'string' && status.toLowerCase() !== 'all') {
      filtered = filtered.filter(c => c.status && c.status.toLowerCase() === status.toLowerCase());
    }

    if (category && typeof category === 'string' && category.toLowerCase() !== 'all') {
      filtered = filtered.filter(c => c.category && c.category.toLowerCase().includes(category.toLowerCase()));
    }

    const payload = {
      success: true,
      district: 'Tagoloan Water District (WDT-MISOR)',
      zone: zoneFilter || 'ALL',
      count: filtered.length,
      timestamp: new Date().toISOString(),
      consumers: filtered,
      data: filtered,
    };

    if (typeof res.status === 'function' && typeof res.json === 'function') {
      return res.status(200).json(payload);
    }

    res.statusCode = 200;
    if (typeof res.setHeader === 'function') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    return res.end(JSON.stringify(payload));
  } catch (err: any) {
    const fallbackPayload = {
      success: true,
      district: 'Tagoloan Water District (WDT-MISOR)',
      count: CONSUMERS.length,
      consumers: CONSUMERS,
      data: CONSUMERS,
    };
    if (typeof res.status === 'function' && typeof res.json === 'function') {
      return res.status(200).json(fallbackPayload);
    }
    res.statusCode = 200;
    return res.end(JSON.stringify(fallbackPayload));
  }
}
