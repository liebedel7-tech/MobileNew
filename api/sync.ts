// Vercel Serverless Function: /api/sync
import { CONSUMERS } from './consumers';

export default function handler(req: any, res: any) {
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

    if (typeof res.status === 'function' && typeof res.json === 'function') {
      return res.status(200).json(payload);
    }
    res.statusCode = 200;
    return res.end(JSON.stringify(payload));
  } catch (err: any) {
    const fallback = {
      success: true,
      district: 'Tagoloan Water District (WDT-MISOR)',
      count: CONSUMERS.length,
      consumers: CONSUMERS,
    };
    if (typeof res.status === 'function' && typeof res.json === 'function') {
      return res.status(200).json(fallback);
    }
    res.statusCode = 200;
    return res.end(JSON.stringify(fallback));
  }
}
