// Vercel Catch-All API Handler: /api/index
import { CONSUMERS } from './consumers';
import { READERS } from './readers';

const serverlessReadings: any[] = [];

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
    const rawUrl = req.url || '';
    const query = req.query || {};
    const url = rawUrl.toLowerCase();

    // 1. Consumers
    if (url.includes('consumer') || url.includes('pull')) {
      const { zone, barangay, route, search, q } = query;
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
          (c.routeCode && c.routeCode.toLowerCase().includes(z))
        );
      }

      const resp = {
        success: true,
        district: 'Tagoloan Water District (WDT-MISOR)',
        count: filtered.length,
        consumers: filtered,
        data: filtered,
      };
      if (typeof res.status === 'function' && typeof res.json === 'function') return res.status(200).json(resp);
      res.statusCode = 200;
      return res.end(JSON.stringify(resp));
    }

    // 2. Readers
    if (url.includes('reader') || url.includes('staff')) {
      const resp = {
        success: true,
        count: READERS.length,
        readers: READERS,
        data: READERS,
      };
      if (typeof res.status === 'function' && typeof res.json === 'function') return res.status(200).json(resp);
      res.statusCode = 200;
      return res.end(JSON.stringify(resp));
    }

    // 3. Fallback Health
    const health = {
      status: 'ok',
      success: true,
      district: 'Tagoloan Water District (WDT-MISOR)',
      consumersCount: CONSUMERS.length,
      readersCount: READERS.length,
      consumers: CONSUMERS,
      readers: READERS,
    };
    if (typeof res.status === 'function' && typeof res.json === 'function') return res.status(200).json(health);
    res.statusCode = 200;
    return res.end(JSON.stringify(health));
  } catch (err: any) {
    const fallback = {
      success: true,
      district: 'Tagoloan Water District (WDT-MISOR)',
      consumers: CONSUMERS,
      readers: READERS,
    };
    if (typeof res.status === 'function' && typeof res.json === 'function') return res.status(200).json(fallback);
    res.statusCode = 200;
    return res.end(JSON.stringify(fallback));
  }
}
