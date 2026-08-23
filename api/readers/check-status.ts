import { DistrictReader, getSharedReaders } from '../seedData';

export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const url = req.url || '';
    const query = req.query || {};
    const parts = url.split('/');
    const pathId = parts[parts.length - 1]?.split('?')[0];
    const checkId = (query.id || query.checkStatus || query.readerId || pathId || '').toString().toLowerCase().trim();

    const readersStore = getSharedReaders();
    const reader = readersStore.find(r =>
      (r.id && r.id.toLowerCase() === checkId) ||
      (r.username && r.username.toLowerCase() === checkId) ||
      (r.employeeId && r.employeeId.toLowerCase() === checkId)
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
  } catch (err: any) {
    return res.status(200).json({
      success: true,
      status: 'pending',
      employmentStatus: 'pending',
      assignedRoutes: ['Poblacion'],
    });
  }
}

