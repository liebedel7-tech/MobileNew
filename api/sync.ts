import { INITIAL_CONSUMERS } from './seedData';
import { sendJson, setCorsHeaders } from './_helper';

export default function handler(req: any, res: any) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    if (typeof res.status === 'function') {
      return res.status(200).end();
    }
    res.statusCode = 200;
    return res.end();
  }

  try {
    const query = req.query || {};
    const zone = (query.zone || query.barangay || 'ALL') as string;

    let consumers = [...INITIAL_CONSUMERS];
    if (zone && zone !== 'ALL' && zone !== 'All') {
      consumers = consumers.filter(c => 
        (c.barangay && c.barangay.toLowerCase().includes(zone.toLowerCase())) ||
        (c.routeCode && c.routeCode.toLowerCase().includes(zone.toLowerCase()))
      );
    }

    return sendJson(res, 200, {
      success: true,
      district: 'Tagoloan Water District (WDT-MISOR)',
      zone,
      count: consumers.length,
      timestamp: new Date().toISOString(),
      consumers,
      data: consumers,
    });
  } catch (err: any) {
    return sendJson(res, 200, {
      success: true,
      district: 'Tagoloan Water District (WDT-MISOR)',
      count: INITIAL_CONSUMERS.length,
      consumers: INITIAL_CONSUMERS,
    });
  }
}
