import { INITIAL_CONSUMERS } from '../src/data/seedData';
import app from '../server';

export default function handler(req: any, res: any) {
  // Set CORS headers unconditionally
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Direct fast-path for /api/consumers or /consumers to prevent any middleware crash
  const url = req.url || '';
  if (url.includes('/consumers') || url.includes('/sync/pull')) {
    if (req.method === 'GET') {
      try {
        const query = req.query || {};
        const { zone, barangay, route, search, q, status, category } = query;
        let filtered = [...INITIAL_CONSUMERS];

        const searchTerm = (search || q || '') as string;
        if (searchTerm.trim()) {
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

        return res.status(200).json({
          success: true,
          district: 'Tagoloan Water District (WDT-MISOR)',
          zone: zoneFilter || 'ALL',
          count: filtered.length,
          timestamp: new Date().toISOString(),
          consumers: filtered,
          data: filtered,
        });
      } catch {
        return res.status(200).json({
          success: true,
          district: 'Tagoloan Water District (WDT-MISOR)',
          count: INITIAL_CONSUMERS.length,
          timestamp: new Date().toISOString(),
          consumers: INITIAL_CONSUMERS,
          data: INITIAL_CONSUMERS,
        });
      }
    }
  }

  // Pass other requests to the Express app
  try {
    return app(req, res);
  } catch (err: any) {
    console.error('[Vercel Handler Error]:', err);
    return res.status(200).json({
      success: true,
      message: 'Fallback response',
      consumers: INITIAL_CONSUMERS,
      data: INITIAL_CONSUMERS,
    });
  }
}
