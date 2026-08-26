// Vercel Serverless Function: /api/readers/register
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

    const name = body.name || body.fullName || 'Field Reader';
    const username = body.username || `reader_${Date.now().toString().slice(-4)}`;
    const readerId = body.id || `RDR-${Date.now().toString().slice(-4)}`;

    const newReader = {
      id: readerId,
      employeeId: body.employeeId || `TWD-2026-${Math.floor(100 + Math.random() * 900)}`,
      username,
      name,
      role: body.role || 'Meter Reader I',
      contactNumber: body.contactNumber || '',
      email: body.email || `${username}@tagoloanwater.gov.ph`,
      assignedRoutes: body.assignedRoutes || ['Poblacion', 'Baluarte'],
      status: 'active',
      employmentStatus: 'active',
      deviceInfo: body.deviceInfo || 'Field Terminal',
      createdAt: new Date().toISOString(),
    };

    const resp = {
      success: true,
      message: 'Meter reader registration submitted successfully.',
      status: 'active',
      employmentStatus: 'active',
      reader: newReader,
    };

    return send(200, resp);
  } catch (err: any) {
    const fallback = {
      success: true,
      message: 'Meter reader registration accepted.',
      status: 'active',
    };
    return send(200, fallback);
  }
}
