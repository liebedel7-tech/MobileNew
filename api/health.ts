import { INITIAL_CONSUMERS, INITIAL_READERS } from './seedData';
import { sendJson, setCorsHeaders } from './_helper';

export default function handler(req: any, res: any) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    if (typeof res.status === 'function') {
      return res.status(200).end();
    }
    res.statusCode = 200;
    return res.end();
  }

  return sendJson(res, 200, {
    status: 'ok',
    district: 'Tagoloan Water District',
    code: 'WDT-MISOR',
    lwuaCategory: 'Category C Water District',
    serverTime: new Date().toISOString(),
    totalConsumers: INITIAL_CONSUMERS.length,
    totalRegisteredReaders: INITIAL_READERS.length,
    service: 'Tagoloan Water District Central Billing & Field Sync API',
  });
}
