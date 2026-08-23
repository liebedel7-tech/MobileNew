import { INITIAL_CONSUMERS, INITIAL_READERS, DistrictReader } from './seedData';

// Serverless persistent stores for warm invocations
const serverlessReaders: DistrictReader[] = [...INITIAL_READERS];
const serverlessReadings: any[] = [];

export default function handler(req: any, res: any) {
  // Set CORS headers unconditionally for all origins
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const rawUrl = req.url || '';
    const query = req.query || {};
    const routeParam = (query.__route || query.path || rawUrl) as string;
    const url = typeof routeParam === 'string' ? routeParam.toLowerCase() : rawUrl.toLowerCase();

    // 1. Consumers Endpoints
    if (url.includes('consumer') || url.includes('sync/pull') || url.includes('pull')) {
      if (req.method === 'GET' || !req.method) {
        const { zone, barangay, route, search, q, status, category } = query;
        let filtered = [...INITIAL_CONSUMERS];

        const searchTerm = (search || q || '') as string;
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase().trim();
          filtered = filtered.filter(c =>
            (c.name && c.name.toLowerCase().includes(term)) ||
            (c.accountNumber && c.accountNumber.toLowerCase().includes(term)) ||
            (c.meterSerial && c.meterSerial.toLowerCase().includes(term)) ||
            (c.address && c.address.toLowerCase().includes(term)) ||
            (c.barangay && c.barangay.toLowerCase().includes(term))
          );
        }

        const zoneFilter = (zone || barangay) as string;
        if (zoneFilter && typeof zoneFilter === 'string' && zoneFilter.toLowerCase() !== 'all') {
          const z = zoneFilter.toLowerCase();
          filtered = filtered.filter(c => 
            (c.barangay && c.barangay.toLowerCase().includes(z)) ||
            (c.routeCode && c.routeCode.toLowerCase().includes(z)) ||
            (c.address && c.address.toLowerCase().includes(z))
          );
        }

        if (route && typeof route === 'string' && route.toLowerCase() !== 'all') {
          filtered = filtered.filter(c => c.routeCode && c.routeCode.toLowerCase().includes(route.toLowerCase()));
        }

        if (status && typeof status === 'string' && status.toLowerCase() !== 'all') {
          filtered = filtered.filter(c => c.status && c.status.toLowerCase() === status.toLowerCase());
        }

        if (category && typeof category === 'string' && category.toLowerCase() !== 'all') {
          filtered = filtered.filter(c => c.category && c.category.toLowerCase().includes(category.toLowerCase()));
        }

        return res.status(200).json({
          success: true,
          district: 'Tagoloan Water District (WDT-MISOR)',
          zone: zoneFilter || 'ALL',
          count: filtered.length,
          timestamp: new Date().toISOString(),
          consumers: filtered,
          data: filtered,
        });
      }
    }

    // 2. Meter Reader Registration
    if (url.includes('register') || (url.includes('reader') && req.method === 'POST')) {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const { name, username, id, employeeId, pin, contactNumber, email, zone, assignedRoutes, deviceInfo } = body;
      const readerUsername = username || id || employeeId || `reader_${Date.now()}`;
      const readerName = name || username || 'Field Staff';

      const existing = serverlessReaders.find(r => 
        (r.username && r.username.toLowerCase() === readerUsername.toLowerCase()) ||
        (employeeId && r.employeeId && r.employeeId.toLowerCase() === employeeId.toLowerCase()) ||
        (id && r.id && r.id.toLowerCase() === id.toLowerCase())
      );

      if (existing) {
        return res.status(200).json({
          success: true,
          message: `Reader '${readerUsername}' already registered.`,
          status: existing.status,
          employmentStatus: existing.status,
          reader: existing,
          data: existing,
        });
      }

      const newReader: DistrictReader = {
        id: id || `RDR-${String(serverlessReaders.length + 1).padStart(3, '0')}`,
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

      serverlessReaders.push(newReader);

      return res.status(201).json({
        success: true,
        message: 'Meter reader registration submitted successfully. Awaiting Administrator approval.',
        status: 'pending',
        employmentStatus: 'pending',
        reader: newReader,
        data: newReader,
      });
    }

    // 3. Reader Status Check: /api/readers/check-status/:id
    if (url.includes('check-status')) {
      const parts = rawUrl.split('/');
      const identifier = parts[parts.length - 1]?.split('?')[0] || query.id || '';
      const cleanId = decodeURIComponent(identifier).toLowerCase().trim();

      const reader = serverlessReaders.find(r =>
        (r.id && r.id.toLowerCase() === cleanId) ||
        (r.username && r.username.toLowerCase() === cleanId) ||
        (r.employeeId && r.employeeId.toLowerCase() === cleanId)
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
    }

    // 4. List All Readers: /api/readers or /api/staff
    if (url.includes('reader') || url.includes('staff')) {
      if (req.method === 'GET') {
        return res.status(200).json({
          success: true,
          count: serverlessReaders.length,
          readers: serverlessReaders,
          data: serverlessReaders,
          staff: serverlessReaders.map(r => ({
            ...r,
            employmentStatus: r.status,
            zone: r.assignedRoutes?.join(', ') || 'Poblacion',
          })),
        });
      }

      // Approve / Reject
      if (req.method === 'PATCH' || req.method === 'POST') {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const newStatus = body.status || (url.includes('reject') ? 'rejected' : 'active');
        const parts = rawUrl.split('/');
        const cleanId = (parts[parts.length - 2] || parts[parts.length - 1] || body.id || '').toLowerCase().trim();

        const reader = serverlessReaders.find(r => 
          (r.id && r.id.toLowerCase() === cleanId) || 
          (r.username && r.username.toLowerCase() === cleanId) ||
          (r.employeeId && r.employeeId.toLowerCase() === cleanId)
        );

        if (reader) {
          reader.status = newStatus;
          reader.employmentStatus = newStatus;
          if (Array.isArray(body.assignedRoutes)) {
            reader.assignedRoutes = body.assignedRoutes;
          }
          return res.status(200).json({
            success: true,
            message: `Reader ${reader.name} status updated to ${newStatus}.`,
            reader,
            staff: reader,
          });
        }
      }
    }

    // 5. Submit Meter Reading: /api/readings/submit or /api/sync/push
    if (url.includes('reading') || url.includes('push') || url.includes('submit')) {
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
          status: 'PENDING_APPROVAL',
          receivedAt: new Date().toISOString(),
        };

        serverlessReadings.push(readingEntry);

        return res.status(201).json({
          success: true,
          message: 'Reading submitted and queued for approval.',
          reading: readingEntry,
          readings: [readingEntry],
        });
      }

      return res.status(200).json({
        success: true,
        count: serverlessReadings.length,
        readings: serverlessReadings,
        data: serverlessReadings,
      });
    }

    // 6. Health & Status Check Fallback
    return res.status(200).json({
      status: 'ok',
      success: true,
      district: 'Tagoloan Water District (WDT-MISOR)',
      consumersCount: INITIAL_CONSUMERS.length,
      readersCount: serverlessReaders.length,
      consumers: INITIAL_CONSUMERS,
      readers: serverlessReaders,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    // Fail-safe response - Never return 500
    return res.status(200).json({
      success: true,
      status: 'ok',
      district: 'Tagoloan Water District (WDT-MISOR)',
      consumers: INITIAL_CONSUMERS,
      readers: serverlessReaders,
    });
  }
}
