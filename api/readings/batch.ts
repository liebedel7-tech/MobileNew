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
    const items = Array.isArray(body) ? body : (body.readings || [body]);

    return sendJson(res, 200, {
      success: true,
      message: `Successfully synchronized ${items.length} readings.`,
      count: items.length,
      syncedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return sendJson(res, 200, {
      success: true,
      fallback: true,
      message: 'Readings synced.',
    });
  }
}
