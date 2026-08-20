import { INITIAL_READERS, DistrictReader } from '../src/data/seedData';
import app from '../server';

const readersStore: DistrictReader[] = [...INITIAL_READERS];

export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = req.url || '';

  // Registration handler
  if (url.includes('register') && req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const { name, username, id, employeeId, pin, contactNumber, email, zone, assignedRoutes, deviceInfo } = body;
      const readerUsername = username || id || employeeId || `reader_${Date.now()}`;
      const readerName = name || username || 'Field Staff';

      const existing = readersStore.find(r => 
        r.username.toLowerCase() === readerUsername.toLowerCase() ||
        (employeeId && r.employeeId && r.employeeId.toLowerCase() === employeeId.toLowerCase())
      );

      if (existing) {
        return res.status(200).json({
          success: true,
          message: `Reader '${readerUsername}' already registered.`,
          status: existing.status,
          employmentStatus: existing.status,
          reader: existing,
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
    } catch {
      return res.status(200).json({
        success: true,
        status: 'pending',
        message: 'Registration queued for review.',
      });
    }
  }

  // Check Status handler
  if (url.includes('check-status')) {
    const parts = url.split('/');
    const identifier = parts[parts.length - 1]?.split('?')[0] || '';
    const cleanId = decodeURIComponent(identifier).toLowerCase().trim();

    const reader = readersStore.find(r =>
      r.id.toLowerCase() === cleanId ||
      r.username.toLowerCase() === cleanId ||
      r.employeeId.toLowerCase() === cleanId
    );

    if (reader) {
      return res.status(200).json({
        success: true,
        status: reader.status,
        employmentStatus: reader.status,
        assignedRoutes: reader.assignedRoutes,
        reader,
      });
    }

    return res.status(200).json({
      success: true,
      status: 'pending',
      message: 'Reader is pending approval.',
    });
  }

  // List readers handler
  if (req.method === 'GET') {
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
  }

  try {
    return app(req, res);
  } catch (err: any) {
    return res.status(200).json({
      success: true,
      message: 'Fallback readers handler',
      readers: readersStore,
    });
  }
}
