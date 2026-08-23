import { INITIAL_CONSUMERS, INITIAL_READERS } from './seedData';

export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return res.status(200).json({
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
