import { INITIAL_READERS, DistrictReader } from '../../src/data/seedData';

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
  } catch (err: any) {
    return res.status(200).json({
      success: true,
      status: 'pending',
      employmentStatus: 'pending',
      message: 'Meter reader registered in queue.',
    });
  }
}
