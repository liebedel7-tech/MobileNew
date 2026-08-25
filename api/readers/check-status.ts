import { DistrictReader, getSharedReaders } from '../seedData';
import { sendJson, setCorsHeaders } from '../_helper';

export default function handler(req: any, res: any) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    if (typeof res.status === 'function') {
      return res.status(200).end();
    }
    res.statusCode = 200;
    return res.end();
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
      return sendJson(res, 200, {
        success: true,
        status: reader.status,
        employmentStatus: reader.status,
        assignedRoutes: reader.assignedRoutes,
        reader,
        data: reader,
      });
    }

    return sendJson(res, 200, {
      success: true,
      status: 'pending',
      employmentStatus: 'pending',
      assignedRoutes: ['Poblacion'],
      message: 'Reader is pending approval.',
    });
  } catch (err: any) {
    return sendJson(res, 200, {
      success: true,
      status: 'pending',
      employmentStatus: 'pending',
      assignedRoutes: ['Poblacion'],
    });
  }
}
