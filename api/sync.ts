// Vercel Serverless Function: /api/sync
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
  }
];

export default function handler(req: any, res?: any) {
  const send = (status: number, payload: any) => {
    const json = JSON.stringify(payload);
    if (res) {
      try {
        if (typeof res.setHeader === 'function') {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', '*');
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
        }
        if (typeof res.status === 'function') {
          if (typeof res.json === 'function') return res.status(status).json(payload);
          return res.status(status).end(json);
        }
        res.statusCode = status;
        if (typeof res.end === 'function') return res.end(json);
      } catch {
        // ignore
      }
    }
    return new Response(json, {
      status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
  };

  const method = req?.method || 'GET';
  if (method === 'OPTIONS') {
    return send(200, { ok: true });
  }

  try {
    let query: Record<string, string> = {};
    if (req?.query && typeof req.query === 'object') {
      for (const [k, v] of Object.entries(req.query)) {
        if (typeof v === 'string') query[k] = v;
      }
    } else if (req?.url) {
      try {
        const u = new URL(req.url, 'http://localhost');
        u.searchParams.forEach((val, key) => {
          query[key] = val;
        });
      } catch {}
    }

    const zone = (query.zone || query.barangay || 'ALL') as string;

    let consumers = [...CONSUMERS];
    if (zone && zone !== 'ALL' && zone !== 'All') {
      consumers = consumers.filter(c => 
        (c.barangay && c.barangay.toLowerCase().includes(zone.toLowerCase())) ||
        (c.routeCode && c.routeCode.toLowerCase().includes(zone.toLowerCase()))
      );
    }

    const payload = {
      success: true,
      district: 'Tagoloan Water District (WDT-MISOR)',
      zone,
      count: consumers.length,
      timestamp: new Date().toISOString(),
      consumers,
      data: consumers,
    };

    return send(200, payload);
  } catch (err: any) {
    const fallback = {
      success: true,
      district: 'Tagoloan Water District (WDT-MISOR)',
      count: CONSUMERS.length,
      consumers: CONSUMERS,
    };
    return send(200, fallback);
  }
}
