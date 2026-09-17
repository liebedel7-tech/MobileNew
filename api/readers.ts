// Vercel Serverless Function: /api/readers
import { INITIAL_READERS } from '../src/data/seedData';

export const READERS = [...INITIAL_READERS];

declare global {
  var __TWD_READERS_LIST__: any[] | undefined;
}

if (!globalThis.__TWD_READERS_LIST__) {
  globalThis.__TWD_READERS_LIST__ = [...READERS];
}

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
    const list = globalThis.__TWD_READERS_LIST__ || READERS;
    const url = (req?.url || '').toLowerCase();
    let query: Record<string, string> = {};
    if (req?.query && typeof req.query === 'object') {
      for (const [k, v] of Object.entries(req.query)) {
        if (typeof v === 'string') query[k] = v;
      }
    }

    // 1. Check Status
    const checkId = (query.id || query.checkStatus || query.readerId || '').toString().toLowerCase().trim();
    if (checkId || url.includes('check-status')) {
      const parts = url.split('/');
      const pathId = parts[parts.length - 1]?.split('?')[0];
      const target = checkId || pathId || '';

      const found = list.find((r: any) =>
        (r.id && r.id.toLowerCase() === target) ||
        (r.username && r.username.toLowerCase() === target) ||
        (r.employeeId && r.employeeId.toLowerCase() === target)
      );

      const resp = found ? {
        success: true,
        status: found.status,
        employmentStatus: found.status,
        assignedRoutes: found.assignedRoutes,
        reader: found,
        data: found,
      } : {
        success: true,
        status: 'pending',
        employmentStatus: 'pending',
        assignedRoutes: ['Poblacion'],
        message: 'Reader is pending approval.',
      };

      return send(200, resp);
    }

    // 2. Register / Add Reader
    if (method === 'POST') {
      let body: any = {};
      if (req?.body) {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      }

      const name = (body.name || body.fullName || body.username || 'Field Staff').trim();
      const username = (body.username || body.id || `reader_${Date.now().toString().slice(-4)}`).trim();
      const newReader = {
        id: body.id || `RDR-${String(list.length + 1).padStart(3, '0')}`,
        employeeId: body.employeeId || `TWD-2026-${Math.floor(100 + Math.random() * 900)}`,
        username,
        name,
        pin: body.pin || '1234',
        contactNumber: body.contactNumber || '',
        email: body.email || `${username.toLowerCase()}@tagoloanwater.gov.ph`,
        assignedRoutes: body.assignedRoutes || ['Poblacion'],
        status: body.status || 'pending',
        employmentStatus: body.status || 'pending',
        deviceInfo: body.deviceInfo || 'Mobile Reader App',
        createdAt: new Date().toISOString(),
      };

      list.push(newReader);

      const resp = {
        success: true,
        message: 'Meter reader registration submitted successfully.',
        status: newReader.status,
        employmentStatus: newReader.status,
        reader: newReader,
        data: newReader,
      };

      return send(201, resp);
    }

    // 3. Return all readers
    const all = {
      success: true,
      count: list.length,
      readers: list,
      data: list,
      staff: list.map((r: any) => ({
        ...r,
        employmentStatus: r.status,
        zone: r.assignedRoutes?.join(', ') || 'Poblacion',
      })),
    };

    return send(200, all);
  } catch (err: any) {
    const list = globalThis.__TWD_READERS_LIST__ || READERS;
    const fallback = {
      success: true,
      count: list.length,
      readers: list,
      data: list,
    };
    return send(200, fallback);
  }
}
