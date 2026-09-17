// Vercel Catch-All API Handler: /api/index
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
    const rawUrl = req?.url || '';
    const url = rawUrl.toLowerCase();

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

    if (url.includes('consumer') || url.includes('pull')) {
      const { zones, zone, barangay, routes, route } = query;
      let targetConsumers = [...CONSUMERS];

      const areaParam = (routes || route || zones || zone || barangay || '') as string;
      if (areaParam && typeof areaParam === 'string' && areaParam.trim()) {
        const parsedAreas = areaParam
          .split(/[,|+]/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && s.toUpperCase() !== 'ALL');

        if (parsedAreas.length > 0) {
          targetConsumers = targetConsumers.filter((c) => isConsumerInAssignedAreas(c, parsedAreas));
        }
      }

      const resp = {
        success: true,
        district: 'Tagoloan Water District (WDT-MISOR)',
        count: targetConsumers.length,
        consumers: targetConsumers,
        data: targetConsumers,
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
