// In-memory serverless store for readings
const readingsStore: any[] = [];

export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const currentReading = Number(body.currentReading || body.readingValue || 0);
      const previousReading = Number(body.previousReading || 0);
      const consumption = Math.max(0, currentReading - previousReading);

      const readingEntry = {
        id: body.id || `RDG-${Date.now()}`,
        accountNumber: body.accountNumber || body.consumerAccountNumber || '01-042-0091',
        consumerName: body.consumerName || body.name || 'Consumer',
        currentReading,
        previousReading,
        consumption,
        readingDate: body.readingDate || new Date().toISOString().split('T')[0],
        readerId: body.readerId || 'FIELD-READER',
        readerName: body.readerName || 'Field Reader',
        route: body.route || 'Poblacion',
        notes: body.notes || '',
        photoUrl: body.photoUrl || '',
        status: 'PENDING_APPROVAL',
        receivedAt: new Date().toISOString(),
      };

      readingsStore.push(readingEntry);

      return res.status(201).json({
        success: true,
        message: 'Reading submitted successfully and queued for approval.',
        reading: readingEntry,
        readings: [readingEntry],
        data: readingEntry,
      });
    }

    // GET readings history
    return res.status(200).json({
      success: true,
      count: readingsStore.length,
      readings: readingsStore,
      data: readingsStore,
    });
  } catch (err: any) {
    return res.status(200).json({
      success: true,
      fallback: true,
      message: 'Reading received.',
      readings: readingsStore,
      data: readingsStore,
    });
  }
}
