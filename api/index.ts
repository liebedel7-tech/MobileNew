// Vercel Catch-All API Handler: /api/index
const CONSUMERS = [
  {
    id: 'WDT-ACC-01042',
    accountNumber: '01-042-0091',
    name: 'AMORATO, VICENTE G.',
    address: 'Zone 2, Brgy. Poblacion, Tagoloan, Misamis Oriental',
    barangay: 'Poblacion',
    meterSerial: 'MTR-8849201',
    category: 'Residential',
    status: 'Active',
    previousReading: 342,
    routeCode: 'RT-POB-04',
  },
  {
    id: 'WDT-ACC-01043',
    accountNumber: '01-042-0092',
    name: 'CABALLERO, MA. ELENA S.',
    address: 'Purok 4, Brgy. Baluarte, Tagoloan, Misamis Oriental',
    barangay: 'Baluarte',
    meterSerial: 'MTR-7738291',
    category: 'Residential',
    status: 'Active',
    previousReading: 512,
    routeCode: 'RT-BAL-01',
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
    const rawUrl = req?.url || '';
    const url = rawUrl.toLowerCase();

    if (url.includes('consumer') || url.includes('pull')) {
      const resp = {
        success: true,
        district: 'Tagoloan Water District (WDT-MISOR)',
        count: CONSUMERS.length,
        consumers: CONSUMERS,
        data: CONSUMERS,
      };
      return send(200, resp);
    }

    const health = {
      status: 'ok',
      success: true,
      district: 'Tagoloan Water District (WDT-MISOR)',
      consumersCount: CONSUMERS.length,
    };
    return send(200, health);
  } catch (err: any) {
    const fallback = {
      success: true,
      district: 'Tagoloan Water District (WDT-MISOR)',
      consumers: CONSUMERS,
    };
    return send(200, fallback);
  }
}
