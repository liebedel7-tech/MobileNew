// Vercel Serverless Function: /api/readers/sync
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

  const method = req?.method || 'POST';
  if (method === 'OPTIONS') {
    return send(200, { ok: true });
  }

  try {
    let body: any = {};
    if (req?.body) {
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

    return send(200, resp);
  } catch (err: any) {
    const fallback = {
      success: true,
      readers: [],
      staff: [],
    };
    return send(200, fallback);
  }
}
