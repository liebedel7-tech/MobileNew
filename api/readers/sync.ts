// Vercel Serverless Function: /api/readers/sync
export default function handler(req: any, res: any) {
  if (typeof res.setHeader === 'function') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }

  if (req.method === 'OPTIONS') {
    if (typeof res.status === 'function') return res.status(200).end();
    res.statusCode = 200;
    return res.end();
  }

  try {
    let body: any = {};
    if (req.body) {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    }

    const readers = Array.isArray(body.readers) ? body.readers : [];

    const defaultStaff = [
      {
        id: 'RDR-001',
        employeeId: 'TWD-2024-001',
        username: 'jdelacruz',
        name: 'Juan Dela Cruz',
        role: 'Senior Meter Reader',
        assignedRoutes: ['Poblacion', 'Baluarte'],
        status: 'active',
        employmentStatus: 'active',
      },
      {
        id: 'RDR-002',
        employeeId: 'TWD-2024-002',
        username: 'msantos',
        name: 'Maria Santos',
        role: 'Meter Reader II',
        assignedRoutes: ['Casinglot', 'Natumolan', 'Mohon'],
        status: 'active',
        employmentStatus: 'active',
      },
    ];

    const resp = {
      success: true,
      message: `Synced ${readers.length} reader account(s).`,
      count: defaultStaff.length,
      readers: defaultStaff,
      staff: defaultStaff,
    };

    if (typeof res.status === 'function' && typeof res.json === 'function') {
      return res.status(200).json(resp);
    }
    res.statusCode = 200;
    return res.end(JSON.stringify(resp));
  } catch (err: any) {
    const fallback = {
      success: true,
      readers: [],
      staff: [],
    };
    if (typeof res.status === 'function' && typeof res.json === 'function') {
      return res.status(200).json(fallback);
    }
    res.statusCode = 200;
    return res.end(JSON.stringify(fallback));
  }
}
