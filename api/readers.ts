import { DistrictReader, getSharedReaders, upsertSharedReader } from './seedData';

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
    const readersStore = getSharedReaders();

    // 1. Batch Reader Sync or Registration: POST /api/readers
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});

      // Batch Readers Sync from Mobile local store
      if (Array.isArray(body.readers) && body.readers.length > 0) {
        const synced = body.readers.map((r: any) => {
          return upsertSharedReader({
            id: r.id,
            employeeId: r.employeeId,
            username: r.username,
            name: r.name,
            pin: r.pin,
            contactNumber: r.contactNumber,
            email: r.email,
            assignedRoutes: r.assignedRoutes,
            status: r.status,
            deviceInfo: r.deviceInfo,
            createdAt: r.createdAt,
          });
        });

        const allReaders = getSharedReaders();
        return res.status(200).json({
          success: true,
          message: `Synchronized ${synced.length} reader account(s).`,
          count: allReaders.length,
          readers: allReaders,
          data: allReaders,
        });
      }

      // Single Registration
      const name = body.name || body.fullName || body.fullname || body.employeeName || body.username || 'Field Staff';
      const employeeId = body.employeeId || body.employee_id || body.id || body.badgeId;
      const username = (body.username || body.id || body.employeeId || `reader_${Date.now()}`).toString().trim();
      const pin = (body.pin || body.password || '1234').toString().trim();
      const contactNumber = body.contactNumber || body.contact_number || body.phone || body.mobile || '';
      const email = body.email || `${username.toLowerCase()}@tagoloanwater.gov.ph`;
      const assignedRoutes = body.assignedRoutes || body.assignedZones || body.assignedBarangays || (body.zone ? [body.zone] : ['Poblacion']);
      const deviceInfo = body.deviceInfo || 'Android Mobile Device';

      const savedReader = upsertSharedReader({
        id: body.id,
        employeeId,
        username,
        name: name.toString().trim(),
        pin,
        contactNumber,
        email,
        assignedRoutes: Array.isArray(assignedRoutes) && assignedRoutes.length > 0 ? assignedRoutes : ['Poblacion'],
        status: body.status || 'pending',
        deviceInfo,
      });

      return res.status(201).json({
        success: true,
        message: 'Meter reader registration submitted successfully.',
        status: savedReader.status,
        employmentStatus: savedReader.status,
        reader: savedReader,
        data: savedReader,
        allReaders: getSharedReaders(),
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
    const allReaders = getSharedReaders();
    return res.status(200).json({
      success: true,
      count: allReaders.length,
      readers: allReaders,
      data: allReaders,
      staff: allReaders.map(r => ({
        ...r,
        employmentStatus: r.status,
        zone: r.assignedRoutes?.join(', ') || 'Poblacion',
      })),
    });
  } catch (err: any) {
    const allReaders = getSharedReaders();
    return res.status(200).json({
      success: true,
      fallback: true,
      count: allReaders.length,
      readers: allReaders,
      data: allReaders,
    });
  }
}

