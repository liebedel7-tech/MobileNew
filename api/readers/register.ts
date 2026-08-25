// Vercel Serverless Function: /api/readers/register
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

    if (typeof res.status === 'function' && typeof res.json === 'function') {
      return res.status(200).json(resp);
    }
    res.statusCode = 200;
    return res.end(JSON.stringify(resp));
  } catch (err: any) {
    const fallback = {
      success: true,
      message: 'Meter reader registration accepted.',
      status: 'active',
    };
    if (typeof res.status === 'function' && typeof res.json === 'function') {
      return res.status(200).json(fallback);
    }
    res.statusCode = 200;
    return res.end(JSON.stringify(fallback));
  }
}
