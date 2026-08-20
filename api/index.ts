import { INITIAL_CONSUMERS, INITIAL_READERS, DistrictReader } from '../src/data/seedData';
import app from '../server';

// Serverless persistent in-memory store for warm invocations
const serverlessReaders: DistrictReader[] = [...INITIAL_READERS];
const serverlessReadings: any[] = [];

export default function handler(req: any, res: any) {
  // Set CORS headers unconditionally for all origins
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = req.url || '';

  // 1. Consumers Endpoints Fast-path
  if (url.includes('/consumers') || url.includes('/sync/pull')) {
    if (req.method === 'GET') {
      try {
        const query = req.query || {};
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
      } catch {
        return res.status(200).json({
          success: true,
          district: 'Tagoloan Water District (WDT-MISOR)',
          count: INITIAL_CONSUMERS.length,
          timestamp: new Date().toISOString(),
          consumers: INITIAL_CONSUMERS,
          data: INITIAL_CONSUMERS,
        });
      }
    }
  }

  // 2. Meter Reader Registration Fast-path
  if (url.includes('/readers/register') || url.includes('/auth/register')) {
    if (req.method === 'POST') {
      try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const { name, username, id, employeeId, pin, contactNumber, email, zone, assignedRoutes, deviceInfo } = body;
        const readerUsername = username || id || employeeId || `reader_${Date.now()}`;
        const readerName = name || username || 'Field Staff';

        const existing = serverlessReaders.find(r => 
          r.username.toLowerCase() === readerUsername.toLowerCase() ||
          (employeeId && r.employeeId && r.employeeId.toLowerCase() === employeeId.toLowerCase())
        );

        if (existing) {
          return res.status(200).json({
            success: true,
            message: `Reader '${readerUsername}' already registered.`,
            status: existing.status,
            employmentStatus: existing.status,
            reader: existing,
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
      } catch (err: any) {
        return res.status(200).json({
          success: true,
          status: 'pending',
          message: 'Registration queued for review.',
        });
      }
    }
  }

  // 3. Reader Status Check Fast-path
  if (url.includes('/readers/check-status')) {
    const parts = url.split('/');
    const identifier = parts[parts.length - 1]?.split('?')[0] || '';
    const cleanId = decodeURIComponent(identifier).toLowerCase().trim();

    const reader = serverlessReaders.find(r =>
      r.id.toLowerCase() === cleanId ||
      r.username.toLowerCase() === cleanId ||
      r.employeeId.toLowerCase() === cleanId
    );

    if (reader) {
      return res.status(200).json({
        success: true,
        status: reader.status,
        employmentStatus: reader.status,
        assignedRoutes: reader.assignedRoutes,
        reader,
      });
    }

    return res.status(200).json({
      success: true,
      status: 'pending',
      message: 'Reader is pending approval.',
    });
  }

  // 4. List All Readers Fast-path
  if (url.endsWith('/readers') || url.endsWith('/staff') || url.includes('/api/readers?') || url.includes('/api/staff?')) {
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
  }

  // 5. Approve / Update Reader Fast-path
  if (url.includes('/approve') || url.includes('/reject') || url.includes('/status')) {
    const isApprove = url.includes('/approve') || (req.body && req.body.status === 'active');
    const isReject = url.includes('/reject') || (req.body && req.body.status === 'rejected');
    const newStatus = isReject ? 'rejected' : 'active';

    const parts = url.split('/');
    const idSegment = parts.find((_, i) => parts[i + 1] === 'approve' || parts[i + 1] === 'reject' || parts[i + 1] === 'status');
    const cleanId = (idSegment || '').toLowerCase().trim();

    const reader = serverlessReaders.find(r => 
      r.id.toLowerCase() === cleanId || 
      r.username.toLowerCase() === cleanId ||
      r.employeeId.toLowerCase() === cleanId
    );

    if (reader) {
      reader.status = newStatus;
      reader.employmentStatus = newStatus;
      if (req.body && req.body.assignedRoutes) {
        reader.assignedRoutes = req.body.assignedRoutes;
      }
      return res.status(200).json({
        success: true,
        message: `Reader ${reader.name} status updated to ${newStatus}.`,
        reader,
        staff: reader,
      });
    }
  }

  // 6. Submit Meter Reading Fast-path
  if (url.includes('/readings/submit') || url.includes('/sync/push')) {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const readingEntry = {
        id: body.id || `RDG-${Date.now()}`,
        accountNumber: body.accountNumber || body.consumerAccountNumber || '01-042-0091',
        consumerName: body.consumerName || body.name || 'Consumer',
        currentReading: Number(body.currentReading || body.readingValue || 0),
        previousReading: Number(body.previousReading || 0),
        consumption: Math.max(0, Number(body.currentReading || 0) - Number(body.previousReading || 0)),
        readingDate: body.readingDate || new Date().toISOString().split('T')[0],
        readerId: body.readerId || 'FIELD-READER',
        readerName: body.readerName || 'Field Reader',
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
  }

  // 7. Readings History Fast-path
  if (url.includes('/readings/history')) {
    return res.status(200).json({
      success: true,
      count: serverlessReadings.length,
      readings: serverlessReadings,
      data: serverlessReadings,
    });
  }

  // Pass remaining requests to the Express app
  try {
    return app(req, res);
  } catch (err: any) {
    console.error('[Vercel Handler Fallback]:', err);
    return res.status(200).json({
      success: true,
      message: 'Fallback handler response',
      readers: serverlessReaders,
      consumers: INITIAL_CONSUMERS,
    });
  }
}
