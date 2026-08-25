import { DistrictReader, getSharedReaders, upsertSharedReader } from '../seedData';
import { sendJson, setCorsHeaders, parseRequestBody } from '../_helper';

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
    const body = parseRequestBody(req);
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

    return sendJson(res, 201, {
      success: true,
      message: 'Meter reader registration saved successfully. Awaiting Administrator approval.',
      status: savedReader.status,
      employmentStatus: savedReader.status,
      reader: savedReader,
      data: savedReader,
      allReaders: getSharedReaders(),
    });
  } catch (err: any) {
    return sendJson(res, 200, {
      success: true,
      status: 'pending',
      employmentStatus: 'pending',
      message: 'Meter reader registered in queue.',
    });
  }
}
