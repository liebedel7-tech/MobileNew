import { INITIAL_READERS, DistrictReader } from '../src/data/seedData';

// In-memory readers store across serverless warm invocations
const readersStore: DistrictReader[] = [...INITIAL_READERS];

export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const url = req.url || '';
    const query = req.query || {};

    // 1. Meter Reader Registration: POST /api/readers/register or POST /api/readers (when action=register)
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const { name, username, id, employeeId, pin, contactNumber, email, zone, assignedRoutes, deviceInfo } = body;
      const readerUsername = username || id || employeeId || `reader_${Date.now()}`;
      const readerName = name || username || 'Field Staff';

      const existing = readersStore.find(r => 
        (r.username && r.username.toLowerCase() === readerUsername.toLowerCase()) ||
        (employeeId && r.employeeId && r.employeeId.toLowerCase() === employeeId.toLowerCase()) ||
        (id && r.id && r.id.toLowerCase() === id.toLowerCase())
      );

      if (existing) {
        return res.status(200).json({
          success: true,
          message: `Reader '${readerUsername}' is registered.`,
          status: existing.status,
          employmentStatus: existing.status,
          reader: existing,
          data: existing,
        });
      }

      const newReader: DistrictReader = {
        id: id || `RDR-${String(readersStore.length + 1).padStart(3, '0')}`,
        employeeId: employeeId || `TWD-2026-${String(Math.floor(100 + Math.random() * 900))}`,
        username: readerUsername.trim(),
        pin: pin || '1234',
        name: readerName.trim(),
        role: body.role || 'Meter Reader I',
        contactNumber: contactNumber || '',
        email: email || `${readerUsername.toLowerCase()}@tagoloanwater.gov.ph`,
        assignedRoutes: Array.isArray(assignedRoutes) && assignedRoutes.length > 0 ? assignedRoutes : (zone ? [zone] : ['Poblacion']),
        status: 'pending',
        employmentStatus: 'pending',
        deviceInfo: deviceInfo || 'Android Mobile Device',
        createdAt: new Date().toISOString(),
      };

      readersStore.push(newReader);

      return res.status(201).json({
        success: true,
        message: 'Meter reader registration submitted successfully. Awaiting Administrator approval.',
        status: 'pending',
        employmentStatus: 'pending',
        reader: newReader,
        data: newReader,
      });
    }

    // 2. Reader Status Check: GET /api/readers/check-status?id=... or /api/readers?checkStatus=...
    const checkId = query.id || query.checkStatus || query.readerId;
    if (checkId || url.includes('check-status')) {
      const parts = url.split('/');
      const pathId = parts[parts.length - 1]?.split('?')[0];
      const targetId = (checkId || pathId || '').toString().toLowerCase().trim();

      const reader = readersStore.find(r =>
        (r.id && r.id.toLowerCase() === targetId) ||
        (r.username && r.username.toLowerCase() === targetId) ||
        (r.employeeId && r.employeeId.toLowerCase() === targetId)
      );

      if (reader) {
        return res.status(200).json({
          success: true,
          status: reader.status,
          employmentStatus: reader.status,
          assignedRoutes: reader.assignedRoutes,
          reader,
          data: reader,
        });
      }

      return res.status(200).json({
        success: true,
        status: 'pending',
        employmentStatus: 'pending',
        assignedRoutes: ['Poblacion'],
        message: 'Reader is pending approval.',
      });
    }

    // 3. Admin Approval / Update: PATCH or PUT or POST with status
    if (req.method === 'PATCH' || req.method === 'PUT') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const targetId = (query.id || body.id || body.readerId || '').toString().toLowerCase().trim();

      const reader = readersStore.find(r =>
        (r.id && r.id.toLowerCase() === targetId) ||
        (r.username && r.username.toLowerCase() === targetId) ||
        (r.employeeId && r.employeeId.toLowerCase() === targetId)
      );

      if (reader) {
        const newStatus = body.status || 'active';
        reader.status = newStatus;
        reader.employmentStatus = newStatus;
        if (Array.isArray(body.assignedRoutes)) {
          reader.assignedRoutes = body.assignedRoutes;
        }
        return res.status(200).json({
          success: true,
          message: `Reader ${reader.name} status updated to ${newStatus}.`,
          reader,
        });
      }
    }

    // 4. List All Readers: GET /api/readers
    return res.status(200).json({
      success: true,
      count: readersStore.length,
      readers: readersStore,
      data: readersStore,
      staff: readersStore.map(r => ({
        ...r,
        employmentStatus: r.status,
        zone: r.assignedRoutes?.join(', ') || 'Poblacion',
      })),
    });
  } catch (err: any) {
    // Fail-safe response
    return res.status(200).json({
      success: true,
      fallback: true,
      count: readersStore.length,
      readers: readersStore,
      data: readersStore,
    });
  }
}
