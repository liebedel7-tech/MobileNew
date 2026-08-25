// Vercel Serverless Function: /api/health
import { CONSUMERS } from './consumers';
import { READERS } from './readers';

export default function handler(req: any, res: any) {
  if (typeof res.setHeader === 'function') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
  }

  if (req.method === 'OPTIONS') {
    if (typeof res.status === 'function') return res.status(200).end();
    res.statusCode = 200;
    return res.end();
  }

  const payload = {
    status: 'ok',
    district: 'Tagoloan Water District',
    code: 'WDT-MISOR',
    lwuaCategory: 'Category C Water District',
    serverTime: new Date().toISOString(),
    totalConsumers: CONSUMERS.length,
    totalRegisteredReaders: READERS.length,
    service: 'Tagoloan Water District Central Billing & Field Sync API',
  };

  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(200).json(payload);
  }
  res.statusCode = 200;
  return res.end(JSON.stringify(payload));
}
