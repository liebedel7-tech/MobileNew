// Vercel Serverless Function: /api/sync
import { INITIAL_CONSUMERS } from '../src/data/seedData';
import { isConsumerInAssignedAreas } from '../src/constants/routes';

export const CONSUMERS = [...INITIAL_CONSUMERS];

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

    const { zones, zone, barangay, routes } = query;
    const zonesParam = (zones || zone || barangay || routes || 'ALL') as string;

    let consumers = [...CONSUMERS];
    if (zonesParam && zonesParam.toLowerCase() !== 'all' && zonesParam.toLowerCase() !== 'all tagoloan districts') {
      const allowed = zonesParam.split(',').map(s => s.trim()).filter(Boolean);
      if (allowed.length > 0) {
        consumers = consumers.filter(c => isConsumerInAssignedAreas(c, allowed));
      }
    }

    const payload = {
      success: true,
      district: 'Tagoloan Water District (WDT-MISOR)',
      coverageZones: zonesParam,
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
