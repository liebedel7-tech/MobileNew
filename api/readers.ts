// Vercel Serverless Function: /api/readers
export const READERS = [
  {
    id: 'RDR-001',
    employeeId: 'TWD-2024-001',
    username: 'jdelacruz',
    pin: '1234',
    name: 'Juan Dela Cruz',
    role: 'Senior Meter Reader',
    contactNumber: '+63 917 123 4567',
    email: 'jdelacruz@tagoloanwater.gov.ph',
    assignedRoutes: ['Poblacion', 'Baluarte'],
    status: 'active',
    employmentStatus: 'active',
    deviceInfo: 'Samsung Galaxy A54 (TWD Field #1)',
    createdAt: '2026-01-15T08:00:00Z',
  },
  {
    id: 'RDR-002',
    employeeId: 'TWD-2024-002',
    username: 'msantos',
    pin: '2345',
    name: 'Maria Santos',
    role: 'Meter Reader II',
    contactNumber: '+63 918 234 5678',
    email: 'msantos@tagoloanwater.gov.ph',
    assignedRoutes: ['Casinglot', 'Natumolan', 'Mohon'],
    status: 'active',
    employmentStatus: 'active',
    deviceInfo: 'Xiaomi Redmi Note 13 (TWD Field #2)',
    createdAt: '2026-02-01T08:00:00Z',
  },
  {
    id: 'RDR-003',
    employeeId: 'TWD-2025-003',
    username: 'rbautista',
    pin: '3456',
    name: 'Roberto Bautista',
    role: 'Meter Reader I',
    contactNumber: '+63 919 345 6789',
    email: 'rbautista@tagoloanwater.gov.ph',
    assignedRoutes: ['Sta. Ana', 'Sta. Cruz', 'Sugbongcogon'],
    status: 'active',
    employmentStatus: 'active',
    deviceInfo: 'Realme 11 (TWD Field #3)',
    createdAt: '2026-03-10T08:00:00Z',
  },
  {
    id: 'RDR-004',
    employeeId: 'TWD-2026-004',
    username: 'cgomez',
    pin: '4567',
    name: 'Carlos Gomez',
    role: 'Probationary Reader',
    contactNumber: '+63 920 456 7890',
    email: 'cgomez@tagoloanwater.gov.ph',
    assignedRoutes: ['Gracia', 'Rosario'],
    status: 'pending',
    employmentStatus: 'pending',
    deviceInfo: 'Vivo Y27 (Applicant Field Unit)',
    createdAt: '2026-08-18T10:30:00Z',
  },
];

declare global {
  var __TWD_READERS_LIST__: any[] | undefined;
}

if (!globalThis.__TWD_READERS_LIST__) {
  globalThis.__TWD_READERS_LIST__ = [...READERS];
}

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
    const list = globalThis.__TWD_READERS_LIST__ || READERS;
    const url = (req.url || '').toLowerCase();
    const query = req.query || {};

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

      if (typeof res.status === 'function' && typeof res.json === 'function') {
        return res.status(200).json(resp);
      }
      res.statusCode = 200;
      return res.end(JSON.stringify(resp));
    }

    // 2. Register / Add Reader
    if (req.method === 'POST') {
      let body: any = {};
      if (req.body) {
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

      if (typeof res.status === 'function' && typeof res.json === 'function') {
        return res.status(201).json(resp);
      }
      res.statusCode = 201;
      return res.end(JSON.stringify(resp));
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

    if (typeof res.status === 'function' && typeof res.json === 'function') {
      return res.status(200).json(all);
    }
    res.statusCode = 200;
    return res.end(JSON.stringify(all));
  } catch (err: any) {
    const list = globalThis.__TWD_READERS_LIST__ || READERS;
    const fallback = {
      success: true,
      count: list.length,
      readers: list,
      data: list,
    };
    if (typeof res.status === 'function' && typeof res.json === 'function') {
      return res.status(200).json(fallback);
    }
    res.statusCode = 200;
    return res.end(JSON.stringify(fallback));
  }
}
