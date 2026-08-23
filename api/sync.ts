import { INITIAL_CONSUMERS } from './seedData';

export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
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

    return res.status(200).json({
      success: true,
      district: 'Tagoloan Water District (WDT-MISOR)',
      zone,
      count: consumers.length,
      timestamp: new Date().toISOString(),
      consumers,
      data: consumers,
    });
  } catch (err: any) {
    return res.status(200).json({
      success: true,
      district: 'Tagoloan Water District (WDT-MISOR)',
      count: INITIAL_CONSUMERS.length,
      consumers: INITIAL_CONSUMERS,
    });
  }
}
