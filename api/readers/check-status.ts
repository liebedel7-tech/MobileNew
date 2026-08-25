// Vercel Serverless Function: /api/readers/check-status
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

  const query = req.query || {};
  const id = (query.id || 'RDR-001') as string;

  const resp = {
    success: true,
    id,
    name: 'Juan Dela Cruz',
    employeeId: 'TWD-2024-001',
    status: 'active',
    assignedRoutes: ['Poblacion', 'Baluarte'],
    approvedAt: '2026-01-15T08:30:00Z',
    approvedBy: 'Engr. Roberto M. Dael',
  };

  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(200).json(resp);
  }
  res.statusCode = 200;
  return res.end(JSON.stringify(resp));
}
