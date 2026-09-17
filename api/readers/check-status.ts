// Vercel Serverless Function: /api/readers/check-status
import { INITIAL_READERS } from '../../src/data/seedData';

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

  const lookupKey = (query.id || query.username || query.employeeId || '').toLowerCase().trim();
  const reader = INITIAL_READERS.find(
    r => r.id.toLowerCase() === lookupKey ||
         r.username.toLowerCase() === lookupKey ||
         r.employeeId.toLowerCase() === lookupKey
  ) || INITIAL_READERS[0];

  const resp = {
    success: true,
    id: reader.id,
    username: reader.username,
    name: reader.name,
    employeeId: reader.employeeId,
    status: reader.status,
    employmentStatus: reader.employmentStatus,
    assignedRoutes: reader.assignedRoutes,
    approvedAt: '2026-08-01T08:30:00Z',
    approvedBy: 'Engr. Roberto M. Dael',
  };

  return send(200, resp);
}
