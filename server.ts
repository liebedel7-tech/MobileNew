import express from 'express';
import http from 'http';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Set up CORS & JSON response headers for API requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-client-version, x-app-id, Cache-Control, Pragma, X-CSRF-Token');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Track active WebSocket connections (in standalone server mode)
const activeClients = new Set<any>();

function broadcastWebSocketEvent(eventType: string, data: any) {
  if (activeClients.size === 0) return;
  const message = JSON.stringify({
    type: eventType,
    timestamp: new Date().toISOString(),
    payload: data,
  });

  for (const client of activeClients) {
    if (client.readyState === 1 /* OPEN */) {
      try {
        client.send(message);
      } catch (err) {
        console.error('Error sending WS message:', err);
      }
    }
  }
}

// Standalone HTTP & WebSocket server reference
let server: http.Server | null = null;

if (!process.env.VERCEL) {
  try {
    server = http.createServer(app);
    // Dynamically initialize WebSocket server only in standalone container mode
    import('ws').then(({ WebSocketServer }) => {
      if (!server) return;
      const wss = new WebSocketServer({ server, path: '/ws' });

      wss.on('connection', (ws: any) => {
        activeClients.add(ws);
        console.log(`[WS] Field Device connected. Total active connections: ${activeClients.size}`);

        ws.send(JSON.stringify({
          type: 'CONNECTION_ESTABLISHED',
          timestamp: new Date().toISOString(),
          payload: {
            status: 'CONNECTED',
            server: 'Tagoloan Water District Central Billing Node',
            activePeers: activeClients.size,
            district: 'WDT-MISOR',
          },
        }));

        ws.on('message', (raw: any) => {
          try {
            const parsed = JSON.parse(raw.toString());
            if (parsed.type === 'PING') {
              ws.send(JSON.stringify({
                type: 'PONG',
                timestamp: new Date().toISOString(),
                payload: { echo: parsed.payload, serverTime: Date.now() },
              }));
            } else if (parsed.type === 'FIELD_READING_RECORDED') {
              broadcastWebSocketEvent('LIVE_READING_UPDATE', parsed.payload);
            } else if (parsed.type === 'FIELD_STAFF_ACTIVITY') {
              broadcastWebSocketEvent('STAFF_ACTIVITY_STREAM', parsed.payload);
            } else if (parsed.type === 'MODULE_NAVIGATION') {
              broadcastWebSocketEvent('MODULE_NAVIGATION_BROADCAST', parsed.payload);
            } else if (parsed.type === 'PROCESS_EVENT') {
              broadcastWebSocketEvent('PROCESS_TELEMETRY_UPDATE', parsed.payload);
            }
          } catch {
            // ignore malformed ws message
          }
        });

        ws.on('close', () => {
          activeClients.delete(ws);
        });

        ws.on('error', () => {
          activeClients.delete(ws);
        });
      });

      setInterval(() => {
        if (activeClients.size > 0) {
          broadcastWebSocketEvent('SERVER_HEARTBEAT', {
            uptimeSeconds: process.uptime(),
            activeClientsCount: activeClients.size,
          });
        }
      }, 15000);
    }).catch(() => {
      // ws not loaded or in serverless mode
    });
  } catch (err) {
    console.warn('WebSocket server init skipped:', err);
  }
}

// Initialize Gemini if API key is present
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

import { INITIAL_CONSUMERS as DEFAULT_SEED_CONSUMERS } from './src/data/seedData';

// Initial Seed Consumers for Tagoloan Water District (WDT), Misamis Oriental
const INITIAL_CONSUMERS: any[] = [...DEFAULT_SEED_CONSUMERS];

let serverReadings: any[] = [];
let serverAuditLogs: any[] = [
  {
    id: 'LOG-INIT-01',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    action: 'SYSTEM_BOOT',
    userId: 'SYSTEM',
    userName: 'WDT Central Server',
    details: 'Central billing database online. Tariff table 2026-LWUA active.',
    deviceInfo: 'WDT-SRV-01 (Ubuntu Cloud Core)',
  }
];

// In-memory staff users and registered readers for WDT
const REGISTERED_READERS = [
  {
    id: 'WDT-MR04',
    employeeId: 'TWD-2026-088',
    username: 'reader04',
    pin: '1234',
    name: 'Juan Carlo Bautista',
    role: 'Meter Reader III',
    contactNumber: '0917-234-5678',
    email: 'j.bautista@tagoloanwater.gov.ph',
    assignedRoutes: ['Poblacion', 'Baluarte'],
    status: 'active',
    deviceInfo: 'Samsung Galaxy A54 (Android 14)',
    createdAt: '2026-08-01T08:00:00Z',
    approvedAt: '2026-08-01T08:30:00Z',
    approvedBy: 'Engr. Roberto M. Dael',
  },
  {
    id: 'WDT-MR02',
    employeeId: 'TWD-2026-042',
    username: 'reader02',
    pin: '1234',
    name: 'Maria Lourdes Santos',
    role: 'Meter Reader II',
    contactNumber: '0928-891-2345',
    email: 'm.santos@tagoloanwater.gov.ph',
    assignedRoutes: ['Casinglot', 'Mohon'],
    status: 'active',
    deviceInfo: 'Xiaomi Redmi Note 13 (Android 14)',
    createdAt: '2026-08-05T09:00:00Z',
    approvedAt: '2026-08-05T09:15:00Z',
    approvedBy: 'Engr. Roberto M. Dael',
  },
  {
    id: 'RDR-005',
    employeeId: 'TWD-2026-089',
    username: 'arnel_reader',
    pin: '1234',
    name: 'Arnel Mendoza',
    role: 'Meter Reader I',
    contactNumber: '0917-123-4567',
    email: 'arnel.reader@tagoloanwater.gov.ph',
    assignedRoutes: ['Poblacion', 'Natumolan'],
    status: 'pending',
    deviceInfo: 'Samsung Galaxy A54 (Android 14)',
    createdAt: '2026-08-18T10:00:00Z',
  }
];

// In-memory staff users for WDT (compatible lookup)
const STAFF_USERS = REGISTERED_READERS.map(r => ({
  id: r.id,
  username: r.username,
  pin: r.pin,
  name: r.name,
  role: r.role,
  zone: r.assignedRoutes.join(', '),
  status: r.status,
  employeeId: r.employeeId,
  assignedRoutes: r.assignedRoutes,
}));

// API Routes
app.get(['/api/health', '/health'], (req, res) => {
  try {
    res.json({
      status: 'ok',
      district: 'Tagoloan Water District',
      code: 'WDT-MISOR',
      lwuaCategory: 'Category C Water District',
      serverTime: new Date().toISOString(),
      totalConsumers: INITIAL_CONSUMERS.length,
      totalReadingsLogged: serverReadings.length,
      totalRegisteredReaders: REGISTERED_READERS.length,
      pendingApprovalReaders: REGISTERED_READERS.filter(r => r.status === 'pending').length,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Server error' });
  }
});

// Meter Reader Registration & Sync (Mobile App -> Central / Firestore readers collection)
app.all(['/api/readers/register', '/api/readers/sync', '/api/readers/batch-sync', '/api/staff/sync', '/api/auth/register', '/api/readers', '/api/auth/register-reader', '/api/staff/register', '/api/staff', '/readers/register', '/auth/register'], (req, res, next) => {
  if (req.method === 'GET') {
    // If it's a GET request to /api/readers or /api/staff, let next route handle it
    return next();
  }
  if (req.method !== 'POST' && req.method !== 'OPTIONS') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  try {
    const body = req.body || {};

    // 1. Batch Reader Sync from mobile app
    if (Array.isArray(body.readers) && body.readers.length > 0) {
      let newlyAdded = 0;
      body.readers.forEach((r: any) => {
        const uname = (r.username || r.id || r.employeeId || '').toLowerCase().trim();
        const empId = (r.employeeId || '').toLowerCase().trim();
        const rId = (r.id || '').toLowerCase().trim();

        const existingIndex = REGISTERED_READERS.findIndex(
          ex => ex.username.toLowerCase() === uname ||
                (empId && ex.employeeId && ex.employeeId.toLowerCase() === empId) ||
                (rId && ex.id && ex.id.toLowerCase() === rId)
        );

        if (existingIndex >= 0) {
          // If already existing, preserve active status if server approved it
          const existing = REGISTERED_READERS[existingIndex];
          REGISTERED_READERS[existingIndex] = {
            ...existing,
            ...r,
            status: existing.status === 'active' ? 'active' : (r.status || existing.status),
            assignedRoutes: r.assignedRoutes && r.assignedRoutes.length > 0 ? r.assignedRoutes : existing.assignedRoutes,
          };
        } else if (uname) {
          const newR = {
            id: r.id || `RDR-${String(REGISTERED_READERS.length + 1).padStart(3, '0')}`,
            employeeId: r.employeeId || `TWD-2026-${String(Math.floor(100 + Math.random() * 900))}`,
            username: r.username || uname,
            pin: r.pin || '1234',
            name: r.name || uname,
            role: r.role || 'Meter Reader I',
            contactNumber: r.contactNumber || '',
            email: r.email || `${uname}@tagoloanwater.gov.ph`,
            assignedRoutes: Array.isArray(r.assignedRoutes) && r.assignedRoutes.length > 0 ? r.assignedRoutes : ['Poblacion'],
            status: r.status || 'active',
            employmentStatus: r.status || 'active',
            deviceInfo: r.deviceInfo || 'Android Field Terminal',
            createdAt: r.createdAt || new Date().toISOString(),
          };
          REGISTERED_READERS.push(newR);
          newlyAdded++;

          broadcastWebSocketEvent('READER_REGISTERED_ACTIVE', {
            reader: newR,
            totalActive: REGISTERED_READERS.filter(x => x.status === 'active').length,
            timestamp: new Date().toISOString(),
          });
        }
      });

      return res.status(200).json({
        success: true,
        message: `Synced ${body.readers.length} reader account(s) (${newlyAdded} new).`,
        count: REGISTERED_READERS.length,
        readers: REGISTERED_READERS,
        staff: REGISTERED_READERS.map(r => ({
          ...r,
          employmentStatus: r.status,
          zone: r.assignedRoutes?.join(', ') || 'Poblacion',
        })),
      });
    }

    // 2. Single Registration
    const name = body.name || body.fullName || body.fullname || body.employeeName || body.username || 'Field Staff';
    const employeeId = body.employeeId || body.employee_id || body.id || body.badgeId;
    const username = (body.username || body.id || body.employeeId || `reader_${Date.now()}`).toString().trim();
    const pin = (body.pin || body.password || '1234').toString().trim();
    const contactNumber = body.contactNumber || body.contact_number || body.phone || body.mobile || '';
    const email = body.email || `${username.toLowerCase()}@tagoloanwater.gov.ph`;
    const assignedRoutes = body.assignedRoutes || body.assignedZones || body.assignedBarangays || (body.zone ? [body.zone] : ['Poblacion']);
    const deviceInfo = body.deviceInfo || req.headers['user-agent'] || 'Android Mobile Device';

    const readerName = (name || username).toString().trim();
    const readerUsername = username;

    if (!readerName || !readerUsername) {
      return res.status(400).json({ success: false, message: 'Name and Username are required' });
    }

    // Check if username or employeeId already registered
    const existingIndex = REGISTERED_READERS.findIndex(
      r => r.username.toLowerCase() === readerUsername.toLowerCase() || 
           (employeeId && r.employeeId && r.employeeId.toLowerCase() === employeeId.toString().toLowerCase()) ||
           (body.id && r.id && r.id.toLowerCase() === body.id.toString().toLowerCase())
    );

    if (existingIndex >= 0) {
      const existing = REGISTERED_READERS[existingIndex];
      // Update routes if provided
      if (Array.isArray(assignedRoutes) && assignedRoutes.length > 0) {
        existing.assignedRoutes = assignedRoutes;
      }
      return res.status(200).json({
        success: true,
        message: `Meter reader '${readerUsername}' is registered.`,
        status: existing.status,
        employmentStatus: existing.status,
        reader: existing,
        allReaders: REGISTERED_READERS,
      });
    }

    const routes = Array.isArray(assignedRoutes) && assignedRoutes.length > 0 
      ? assignedRoutes 
      : (body.zone ? [body.zone] : ['Poblacion']);

    const newReaderId = body.id || `RDR-${String(REGISTERED_READERS.length + 1).padStart(3, '0')}`;
    const newReader = {
      id: newReaderId,
      employeeId: employeeId || `TWD-2026-${String(Math.floor(100 + Math.random() * 900))}`,
      username: readerUsername,
      pin: pin,
      name: readerName,
      role: body.role || 'Meter Reader I',
      contactNumber: contactNumber,
      email: email,
      assignedRoutes: routes,
      status: 'active', // Instantly active upon registration
      employmentStatus: 'active',
      deviceInfo: deviceInfo,
      createdAt: new Date().toISOString(),
    };

    REGISTERED_READERS.push(newReader);

    // Broadcast WebSocket notification to Admin Web Portal
    broadcastWebSocketEvent('READER_REGISTERED_ACTIVE', {
      reader: newReader,
      totalActive: REGISTERED_READERS.filter(r => r.status === 'active').length,
      timestamp: new Date().toISOString(),
    });

    serverAuditLogs.push({
      id: `LOG-REG-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'READER_REGISTRATION_ACTIVATED',
      userId: newReader.id,
      userName: newReader.name,
      details: `Meter Reader registered on mobile (${newReader.employeeId}). Assigned Coverage: ${newReader.assignedRoutes.join(', ')}. Status ACTIVE.`,
      deviceInfo: newReader.deviceInfo,
    });

    res.status(201).json({
      success: true,
      message: 'Meter reader registered successfully. Ready for field operations.',
      status: 'active',
      employmentStatus: 'active',
      reader: newReader,
      allReaders: REGISTERED_READERS,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Registration failed' });
  }
});


// List all readers (for Admin Portal & Mobile Sync)
app.get(['/api/readers', '/api/staff', '/readers', '/staff'], (req, res) => {
  try {
    res.json({
      success: true,
      count: REGISTERED_READERS.length,
      readers: REGISTERED_READERS,
      staff: REGISTERED_READERS.map(r => ({
        ...r,
        employmentStatus: r.status,
        zone: r.assignedRoutes?.join(', ') || 'Poblacion',
      })),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to list readers' });
  }
});

// Admin updates staff / reader status and routes
app.patch(['/api/staff/:id/status', '/api/readers/:id/status'], (req, res) => {
  const { id } = req.params;
  const { status, assignedRoutes, approvedBy } = req.body;

  const reader = REGISTERED_READERS.find(
    r => r.id.toLowerCase() === id.toLowerCase() || 
         r.username.toLowerCase() === id.toLowerCase() ||
         (r.employeeId && r.employeeId.toLowerCase() === id.toLowerCase())
  );

  if (!reader) {
    return res.status(404).json({ success: false, message: 'Staff / Reader not found' });
  }

  if (status) {
    reader.status = status;
    (reader as any).employmentStatus = status;
  }
  if (Array.isArray(assignedRoutes) && assignedRoutes.length > 0) {
    reader.assignedRoutes = assignedRoutes;
  }
  if (status === 'active') {
    reader.approvedAt = new Date().toISOString();
    reader.approvedBy = approvedBy || 'Admin Supervisor';
  }

  broadcastWebSocketEvent(status === 'active' ? 'READER_APPROVED_ACTIVE' : 'READER_STATUS_CHANGED', {
    readerId: reader.id,
    name: reader.name,
    status: reader.status,
    assignedRoutes: reader.assignedRoutes,
    timestamp: new Date().toISOString(),
  });

  res.json({
    success: true,
    message: `Reader ${reader.name} status updated to ${reader.status}.`,
    reader,
    staff: reader,
  });
});

// Check reader status (Mobile app polls or calls to check if approved)
app.get('/api/readers/check-status/:id', (req, res) => {
  const { id } = req.params;
  const reader = REGISTERED_READERS.find(
    r => r.id.toLowerCase() === id.toLowerCase() || 
         r.username.toLowerCase() === id.toLowerCase() ||
         r.employeeId.toLowerCase() === id.toLowerCase()
  );

  if (!reader) {
    return res.status(404).json({ success: false, message: 'Reader not found' });
  }

  res.json({
    success: true,
    id: reader.id,
    name: reader.name,
    employeeId: reader.employeeId,
    status: reader.status,
    assignedRoutes: reader.assignedRoutes,
    approvedAt: reader.approvedAt,
    approvedBy: reader.approvedBy,
  });
});

// Admin approves reader & assigns routes (Supports both PATCH and POST)
app.all('/api/readers/:id/approve', (req, res) => {
  if (req.method !== 'PATCH' && req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }
  const { id } = req.params;
  const { assignedRoutes, approvedBy } = req.body;

  const reader = REGISTERED_READERS.find(
    r => r.id.toLowerCase() === id.toLowerCase() || 
         r.username.toLowerCase() === id.toLowerCase() ||
         (r.employeeId && r.employeeId.toLowerCase() === id.toLowerCase())
  );

  if (!reader) {
    return res.status(404).json({ success: false, message: 'Reader not found' });
  }

  reader.status = 'active';
  if (Array.isArray(assignedRoutes) && assignedRoutes.length > 0) {
    reader.assignedRoutes = assignedRoutes;
  }
  reader.approvedAt = new Date().toISOString();
  reader.approvedBy = approvedBy || 'Admin Supervisor';

  // Broadcast WebSocket event so mobile app instantly unlocks
  broadcastWebSocketEvent('READER_APPROVED_ACTIVE', {
    readerId: reader.id,
    employeeId: reader.employeeId,
    username: reader.username,
    name: reader.name,
    status: 'active',
    assignedRoutes: reader.assignedRoutes,
    timestamp: new Date().toISOString(),
  });

  serverAuditLogs.push({
    id: `LOG-APP-${Date.now()}`,
    timestamp: new Date().toISOString(),
    action: 'READER_ACCOUNT_APPROVED',
    userId: reader.id,
    userName: reader.name,
    details: `Admin approved meter reader ${reader.name} (${reader.employeeId}). Assigned Routes: ${reader.assignedRoutes.join(', ')}`,
    deviceInfo: 'Web Admin Portal',
  });

  res.json({
    success: true,
    message: `Reader ${reader.name} approved successfully. Status is now ACTIVE.`,
    reader,
  });
});

// Admin terminates / revokes reader account
app.all(['/api/readers/:id/terminate', '/api/staff/:id/terminate', '/api/readers/:id/reject', '/api/staff/:id/reject'], (req, res) => {
  const { id } = req.params;
  const { reason, terminatedBy } = req.body || {};
  const reader = REGISTERED_READERS.find(
    r => r.id.toLowerCase() === id.toLowerCase() || 
         r.username.toLowerCase() === id.toLowerCase() ||
         (r.employeeId && r.employeeId.toLowerCase() === id.toLowerCase())
  );

  if (!reader) {
    return res.status(404).json({ success: false, message: 'Reader not found' });
  }

  reader.status = 'terminated';
  (reader as any).employmentStatus = 'terminated';

  broadcastWebSocketEvent('READER_ACCOUNT_TERMINATED', {
    readerId: reader.id,
    name: reader.name,
    status: 'terminated',
    reason: reason || 'Account revoked by administrator',
    timestamp: new Date().toISOString(),
  });

  serverAuditLogs.push({
    id: `LOG-TERM-${Date.now()}`,
    timestamp: new Date().toISOString(),
    action: 'READER_ACCOUNT_TERMINATED',
    userId: reader.id,
    userName: reader.name,
    details: `Admin terminated meter reader account ${reader.name} (${reader.employeeId}). ${reason || ''}`,
    deviceInfo: 'Admin Web Portal',
  });

  res.json({
    success: true,
    message: `Reader account for ${reader.name} has been terminated.`,
    reader,
  });
});

// Authentication with Status Check
app.post(['/api/auth/login', '/auth/login'], (req, res) => {
  try {
    const { username, pin, readerId } = req.body;
    if (!username && !readerId) {
      return res.status(400).json({ success: false, message: 'Username or Reader ID is required' });
    }
    if (!pin) {
      return res.status(400).json({ success: false, message: 'Password / Security PIN is required' });
    }

    const cleanPin = pin.toString().trim();
    const cleanUser = (username || readerId || '').toString().toLowerCase().trim();

    const user = REGISTERED_READERS.find(
      u => (u.username.toLowerCase() === cleanUser || 
            u.id.toLowerCase() === cleanUser ||
            (u.employeeId && u.employeeId.toLowerCase() === cleanUser)) &&
           (u.pin === cleanPin)
    );

    if (user) {
      if (user.status === 'terminated' || user.status === 'rejected') {
        return res.status(403).json({
          success: false,
          status: user.status,
          message: 'This meter reader account has been terminated or revoked by administration.',
        });
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          employeeId: user.employeeId,
          username: user.username,
          name: user.name,
          role: user.role,
          zone: (user.assignedRoutes || ['Poblacion']).join(', '),
          assignedRoutes: user.assignedRoutes || ['Poblacion'],
          status: 'active',
        },
        serverSyncTime: new Date().toISOString(),
      });
    } else {
      res.status(401).json({
        success: false,
        message: 'Invalid Staff Username, Employee ID, or Security PIN. Please verify your credentials or register as a new reader.',
      });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Login failed' });
  }
});

// Consumers list download & Route Sync Pull (Multi-Zone coverage support)
app.get(['/api/consumers', '/api/sync/pull', '/consumers', '/sync/pull'], (req, res) => {
  try {
    const { since, zones, zone, barangay, routes, route, search, q, status, category } = req.query;
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

    // Filter strictly by the meter reader's assigned coverage areas / barangays
    const zonesParam = (zones || zone || barangay || routes || route || '') as string;
    if (zonesParam && typeof zonesParam === 'string' && zonesParam.toLowerCase() !== 'all' && zonesParam.toLowerCase() !== 'all tagoloan districts') {
      const allowed = zonesParam
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);

      if (allowed.length > 0) {
        filtered = filtered.filter(c => {
          const brgy = (c.barangay || '').toLowerCase();
          const routeCode = (c.routeCode || '').toLowerCase();
          const addr = (c.address || '').toLowerCase();
          return allowed.some(z => 
            brgy.includes(z) || 
            routeCode.includes(z) || 
            addr.includes(z) ||
            (z === 'sta. cruz' && brgy.includes('santa cruz')) ||
            (z === 'santa cruz' && brgy.includes('sta. cruz')) ||
            (z === 'sta. ana' && brgy.includes('santa ana')) ||
            (z === 'santa ana' && brgy.includes('sta. ana'))
          );
        });
      }
    }

    if (status && typeof status === 'string' && status.toLowerCase() !== 'all') {
      filtered = filtered.filter(c => c.status && c.status.toLowerCase() === status.toLowerCase());
    }

    if (category && typeof category === 'string' && category.toLowerCase() !== 'all') {
      filtered = filtered.filter(c => c.category && c.category.toLowerCase().includes(category.toLowerCase()));
    }

    res.json({
      success: true,
      coverageZones: zonesParam || 'ALL',
      count: filtered.length,
      timestamp: new Date().toISOString(),
      consumers: filtered,
      data: filtered, // Support both 'consumers' and 'data' envelope keys
    });
  } catch (err: any) {
    res.json({
      success: true,
      coverageZones: 'ALL',
      count: INITIAL_CONSUMERS.length,
      timestamp: new Date().toISOString(),
      consumers: INITIAL_CONSUMERS,
      data: INITIAL_CONSUMERS,
    });
  }
});

// Single Consumer Details by Account Number or Meter Serial
app.get(['/api/consumers/:identifier', '/consumers/:identifier'], (req, res) => {
  try {
    const { identifier } = req.params;
    const cleanId = (identifier || '').toLowerCase().trim();
    const consumer = INITIAL_CONSUMERS.find(c => 
      c.accountNumber.toLowerCase() === cleanId ||
      c.id.toLowerCase() === cleanId ||
      (c.meterSerial && c.meterSerial.toLowerCase() === cleanId)
    );

    if (consumer) {
      res.json({
        success: true,
        consumer,
        data: consumer,
      });
    } else {
      res.status(404).json({
        success: false,
        message: `Consumer with Account/Meter '${identifier}' not found in Tagoloan District registry.`,
      });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Error fetching consumer' });
  }
});

// Create or Update Consumer Record
app.post(['/api/consumers', '/consumers'], (req, res) => {
  try {
    const data = req.body;
    if (!data.accountNumber || !data.name) {
      return res.status(400).json({ success: false, message: 'Account Number and Consumer Name are required' });
    }

    const existingIndex = INITIAL_CONSUMERS.findIndex(c => 
      c.accountNumber.toLowerCase() === data.accountNumber.toLowerCase() ||
      (data.id && c.id.toLowerCase() === data.id.toLowerCase())
    );

    const consumerRecord = {
      id: data.id || `WDT-ACC-${Date.now().toString().slice(-5)}`,
      accountNumber: data.accountNumber,
      name: data.name,
      address: data.address || 'Tagoloan, Misamis Oriental',
      barangay: data.barangay || 'Poblacion',
      meterSerial: data.meterSerial || `MTR-${Math.floor(1000000 + Math.random() * 9000000)}`,
      meterSize: data.meterSize || '1/2"',
      category: data.category || 'Residential',
      status: data.status || 'Active',
      previousReading: Number(data.previousReading || 0),
      previousReadingDate: data.previousReadingDate || new Date().toISOString().split('T')[0],
      averageConsumption: Number(data.averageConsumption || 15),
      rateCode: data.rateCode || 'RES-01',
      gpsCoordinates: data.gpsCoordinates || { lat: 8.5398, lng: 124.7523 },
      routeCode: data.routeCode || 'RT-POB-01',
      sequenceNo: data.sequenceNo || INITIAL_CONSUMERS.length + 1,
      contactNumber: data.contactNumber || '',
      lastSyncDate: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      INITIAL_CONSUMERS[existingIndex] = { ...INITIAL_CONSUMERS[existingIndex], ...consumerRecord };
    } else {
      INITIAL_CONSUMERS.push(consumerRecord);
    }

    broadcastWebSocketEvent('CONSUMER_REGISTRY_UPDATED', {
      consumer: consumerRecord,
      action: existingIndex >= 0 ? 'UPDATE' : 'CREATE',
      timestamp: new Date().toISOString(),
    });

    res.status(existingIndex >= 0 ? 200 : 201).json({
      success: true,
      message: existingIndex >= 0 ? 'Consumer updated successfully' : 'Consumer created successfully',
      consumer: consumerRecord,
      data: consumerRecord,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to save consumer' });
  }
});

// Barangays & Tariff Rates Endpoint
app.get(['/api/barangays', '/barangays'], (req, res) => {
  const barangays = [
    { name: 'Poblacion', code: 'POB', activeRoutes: ['RT-POB-01', 'RT-POB-02', 'RT-POB-03', 'RT-POB-04'], totalConsumers: 1420 },
    { name: 'Baluarte', code: 'BAL', activeRoutes: ['RT-BAL-01', 'RT-BAL-02'], totalConsumers: 860 },
    { name: 'Casinglot', code: 'CAS', activeRoutes: ['RT-CAS-01', 'RT-CAS-02', 'RT-CAS-03'], totalConsumers: 1150 },
    { name: 'Mohon', code: 'MOH', activeRoutes: ['RT-MOH-01', 'RT-MOH-02'], totalConsumers: 730 },
    { name: 'Natumolan', code: 'NAT', activeRoutes: ['RT-NAT-01', 'RT-NAT-02'], totalConsumers: 940 },
    { name: 'Santa Ana', code: 'STA', activeRoutes: ['RT-STA-01', 'RT-STA-02'], totalConsumers: 680 },
    { name: 'Santa Cruz', code: 'STC', activeRoutes: ['RT-STC-01', 'RT-STC-02'], totalConsumers: 520 },
    { name: 'Sugbongcogon', code: 'SUG', activeRoutes: ['RT-SUG-01', 'RT-SUG-02', 'RT-SUG-03'], totalConsumers: 1280 },
    { name: 'Gracia', code: 'GRA', activeRoutes: ['RT-GRA-01'], totalConsumers: 410 },
    { name: 'Rosario', code: 'ROS', activeRoutes: ['RT-ROS-01'], totalConsumers: 390 },
  ];

  res.json({
    success: true,
    district: 'Tagoloan Water District (WDT-MISOR)',
    count: barangays.length,
    barangays,
    data: barangays,
  });
});

// Single Reading Submit Endpoint
app.post(['/api/readings/submit', '/api/sync/push', '/readings/submit', '/sync/push'], (req, res) => {
  try {
    const body = req.body;

    // Handle if client sent an array or single object
    const readingsToProcess = Array.isArray(body.readings) 
      ? body.readings 
      : (Array.isArray(body) ? body : [body]);

    if (readingsToProcess.length === 0) {
      return res.status(400).json({ success: false, message: 'No reading data received.' });
    }

    const saved: any[] = [];
    readingsToProcess.forEach((item: any) => {
      const prev = Number(item.previousReading || 0);
      const curr = Number(item.currentReading || item.readingValue || 0);
      const cons = Math.max(0, curr - prev);

      const readingEntry = {
        id: item.id || `RDG-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        consumerId: item.consumerId || item.accountNumber,
        accountNumber: item.accountNumber || item.consumerAccountNumber,
        consumerName: item.consumerName || item.name || 'Account Holder',
        meterSerial: item.meterSerial || item.meterNumber || 'MTR-STD',
        meterNumber: item.meterNumber || item.meterSerial || 'MT-001',
        previousReading: prev,
        currentReading: curr,
        consumption: cons,
        readingDate: item.readingDate || new Date().toISOString().split('T')[0],
        readerId: item.readerId || 'FIELD-STAFF',
        readerName: item.readerName || 'Field Reader',
        route: item.route || item.zone || 'Poblacion',
        billingPeriod: item.billingPeriod || 'August 2026',
        approvalStatus: item.approvalStatus || 'pending_approval',
        status: 'PENDING_APPROVAL',
        photoUrl: item.photoUrl || item.meterPhotoBase64 || '',
        coordinates: item.coordinates || item.gpsLocation || { lat: 8.5398, lng: 124.7523 },
        receivedAt: new Date().toISOString(),
      };

      serverReadings.push(readingEntry);
      saved.push(readingEntry);

      // Broadcast WebSocket update
      broadcastWebSocketEvent('READING_SUBMITTED_FOR_APPROVAL', {
        reading: readingEntry,
        timestamp: new Date().toISOString(),
      });
    });

    res.status(201).json({
      success: true,
      message: `Successfully received ${saved.length} reading(s). Queued for supervisor approval.`,
      readings: saved,
      reading: saved[0],
      count: saved.length,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Reading submit failed' });
  }
});

// Batch reading submission
app.post(['/api/readings/batch', '/readings/batch'], (req, res) => {
  try {
    const { readings, readerId, batchId } = req.body;
    if (!Array.isArray(readings) || readings.length === 0) {
      return res.status(400).json({ success: false, message: 'No readings provided' });
    }

    const processed: any[] = [];
    const errors: any[] = [];

    readings.forEach((reading: any) => {
      try {
        const readingRecord = {
          ...reading,
          receivedAt: new Date().toISOString(),
          serverVerified: true,
          batchId: batchId || `BATCH-${Date.now()}`,
        };
        serverReadings.push(readingRecord);
        processed.push(reading.id || reading.accountNumber);
      } catch (err: any) {
        errors.push({ id: reading.id, error: err.message });
      }
    });

    serverAuditLogs.push({
      id: `LOG-BATCH-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'BATCH_SUBMISSION_PROCESSED',
      userId: readerId || 'FIELD_READER',
      userName: `Meter Reader (${readerId || 'WDT-FIELD'})`,
      details: `Processed ${processed.length} water meter readings in batch ${batchId || 'SYNC'}`,
      deviceInfo: req.headers['user-agent'] || 'Field Mobile Device',
    });

    // Broadcast WebSocket update to all active devices
    broadcastWebSocketEvent('BATCH_SYNC_PROCESSED', {
      readerId: readerId || 'WDT-FIELD',
      batchId: batchId || `BATCH-${Date.now()}`,
      processedCount: processed.length,
      totalServerReadings: serverReadings.length,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      processedCount: processed.length,
      failedCount: errors.length,
      processedIds: processed,
      syncedIds: processed,
      errors,
      serverTimestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Batch submit failed' });
  }
});

// History & Status
app.get(['/api/readings/history', '/readings/history'], (req, res) => {
  res.json({
    success: true,
    total: serverReadings.length,
    readings: serverReadings,
  });
});

// Audit Logs
app.get(['/api/audit-logs', '/audit-logs'], (req, res) => {
  res.json({
    success: true,
    logs: serverAuditLogs.slice(-100).reverse(),
  });
});

app.post(['/api/audit-logs', '/audit-logs'], (req, res) => {
  const { action, userId, userName, details, deviceInfo } = req.body;
  const newLog = {
    id: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    action: action || 'CLIENT_EVENT',
    userId: userId || 'WDT-STAFF',
    userName: userName || 'Staff Field User',
    details: details || '',
    deviceInfo: deviceInfo || 'Mobile Device',
  };
  serverAuditLogs.push(newLog);
  res.json({ success: true, log: newLog });
});

// Readings Pending Admin Approval Queue
app.get(['/api/readings/pending', '/readings/pending'], (req, res) => {
  const pendingReadings = serverReadings.filter(
    (r: any) => r.approvalStatus === 'pending_approval' || (!r.approvalStatus && r.status !== 'SYNCED')
  );

  res.json({
    success: true,
    count: pendingReadings.length,
    readings: pendingReadings,
  });
});

// Admin Approves Meter Reading & Issues Billing Statement
const handleApproveReading = (req: any, res: any) => {
  const { id } = req.params;
  const { approvedBy } = req.body;

  const reading = serverReadings.find((r: any) => r.id === id || r.accountNumber === id);
  if (!reading) {
    return res.status(404).json({ success: false, message: 'Reading not found' });
  }

  reading.approvalStatus = 'approved';
  reading.approvedAt = new Date().toISOString();
  reading.approvedBy = approvedBy || 'Admin Supervisor';
  reading.status = 'SYNCED';

  // Broadcast WebSocket update for live Consumer Portal and Admin Dashboards
  broadcastWebSocketEvent('READING_APPROVED_BILL_ISSUED', {
    readingId: reading.id,
    accountNumber: reading.accountNumber,
    consumerName: reading.consumerName,
    currentReading: reading.currentReading,
    consumption: reading.consumption,
    totalAmountDue: reading.billCalculation?.totalAmountDue,
    status: 'approved',
    timestamp: new Date().toISOString(),
  });

  serverAuditLogs.push({
    id: `LOG-APPRD-${Date.now()}`,
    timestamp: new Date().toISOString(),
    action: 'METER_READING_APPROVED',
    userId: 'ADMIN_DESK',
    userName: approvedBy || 'Billing Officer',
    details: `Approved reading ${reading.currentReading} m³ for Account ${reading.accountNumber} (${reading.consumerName}). Billing Statement Published.`,
    deviceInfo: 'Web Admin Portal',
  });

  res.json({
    success: true,
    message: `Reading for Account ${reading.accountNumber} approved and published to Consumer Portal.`,
    reading,
  });
};

app.post('/api/readings/:id/approve', handleApproveReading);
app.patch('/api/readings/:id/approve', handleApproveReading);

// Admin Rejects / Re-routes Meter Reading
const handleRejectReading = (req: any, res: any) => {
  const { id } = req.params;
  const { reason, rejectedBy } = req.body;

  const reading = serverReadings.find((r: any) => r.id === id || r.accountNumber === id);
  if (!reading) {
    return res.status(404).json({ success: false, message: 'Reading not found' });
  }

  reading.approvalStatus = 'rejected';
  reading.rejectionReason = reason || 'Requires re-inspection';

  broadcastWebSocketEvent('READING_REJECTED_REINSPECT', {
    readingId: reading.id,
    accountNumber: reading.accountNumber,
    reason: reading.rejectionReason,
    timestamp: new Date().toISOString(),
  });

  res.json({
    success: true,
    message: `Reading rejected for re-inspection.`,
    reading,
  });
};

app.post('/api/readings/:id/reject', handleRejectReading);
app.patch('/api/readings/:id/reject', handleRejectReading);

// 📷 Real Camera Optical Vision Analysis: Exclusively Tag Numbers and 5-Digit Meter Readings
app.post('/api/ocr/analyze', async (req, res) => {
  try {
    const { imageBase64, mode = 'reading', previousReading, meterSerial } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ success: false, message: 'Image data is required' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.json({
        success: false,
        status: 'REJECTED_NO_5_DIGITS',
        readingValue: null,
        odometerFormatted: null,
        tagDetected: null,
        digits: [],
        confidence: 0,
        message: 'Vision service unavailable. Please enter manually or check connection.',
      });
    }

    // Clean base64 string
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    // Formulate targeted prompts for Tag Number ONLY vs Dial Reading ONLY
    let prompt = '';
    if (mode === 'tag') {
      prompt = `You are a precise optical character recognition (OCR) engine for water utility meters.
TASK: Inspect the meter image and extract the exact stamped, printed, or engraved Meter Tag Number, Serial Number, or Account Badge (e.g. "TAG-01042", "2024-00104", "TWD-00104", "01042", "MTR-8921").
DO NOT GUESS OR INVENT NUMBERS. Only extract what is clearly legible in the image.
If there is no legible tag or serial number, return status "REJECTED_NO_TAG".

Respond in strict JSON ONLY:
{
  "status": "SUCCESS" | "REJECTED_NO_TAG",
  "tagDetected": "exact alphanumeric tag or serial number detected" | null,
  "confidence": number between 0.0 and 1.0,
  "notes": "short description of tag found"
}`;
    } else {
      prompt = `You are a precise optical character recognition (OCR) engine for mechanical water meters.
TASK: Read the exact numbers on the mechanical rolling odometer counter wheels (index register in cubic meters m³).
INSTRUCTIONS:
1. Examine the horizontal row of rolling digit wheels (usually 4 to 6 wheels, black on white or white on black).
2. Read each digit strictly from LEFT to RIGHT.
3. If red decimal wheels (liters) or sub-dials exist to the right, ignore decimals and focus on the whole cubic meter (m³) integer digits.
4. If a digit wheel is halfway between numbers (e.g. 3 moving to 4), use the smaller digit unless the right wheel has passed 0.
${previousReading !== undefined && previousReading !== null ? `5. The previous logged reading for this meter was ${previousReading} m³. The current reading should normally be >= ${previousReading} m³. Verify carefully against the actual visible digits.` : ''}
6. If the odometer numbers are blurry, dark, glare-obscured, or not clearly visible, DO NOT GUESS OR FABRICATE. Return status "REJECTED_NO_5_DIGITS".

Respond in strict JSON ONLY:
{
  "status": "SUCCESS" | "REJECTED_NO_5_DIGITS",
  "readingValue": number | null,
  "odometerFormatted": "5-digit string like 00368" | null,
  "digits": ["0", "0", "3", "6", "8"] | [],
  "confidence": number between 0.0 and 1.0,
  "meterCondition": "Normal" | "Moisture inside dial" | "Damaged glass" | "Unclear",
  "potentialLeak": boolean,
  "notes": "exact explanation of what digits are visible"
}`;
    }

    let responseText = '';
    const modelsToTry = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-3.7-flash'];

    for (const modelName of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: cleanBase64,
              },
            },
            {
              text: prompt,
            },
          ],
          config: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        });
        if (response?.text) {
          responseText = response.text;
          break;
        }
      } catch (err: any) {
        const msg = err?.message || String(err);
        if (msg.includes('503') || msg.includes('high demand') || msg.includes('UNAVAILABLE') || msg.includes('429')) {
          continue;
        }
      }
    }

    let parsedData: any = null;
    if (responseText) {
      try {
        const cleaned = responseText.trim().replace(/^```json/, '').replace(/```$/, '').trim();
        parsedData = JSON.parse(cleaned);
      } catch {
        parsedData = null;
      }
    }

    if (mode === 'tag') {
      if (parsedData && parsedData.status === 'SUCCESS' && parsedData.tagDetected) {
        const tagClean = String(parsedData.tagDetected).trim();
        return res.json({
          success: true,
          status: 'SUCCESS',
          tagDetected: tagClean,
          meterSerialDetected: tagClean,
          confidence: parsedData.confidence || 0.95,
          notes: parsedData.notes || 'Meter tag identified.',
          source: 'camera_tag_ocr',
        });
      }

      return res.json({
        success: false,
        status: 'REJECTED_NO_TAG',
        tagDetected: null,
        confidence: 0,
        message: 'Could not read meter tag number. Please aim steadily at the meter tag or badge.',
        source: 'camera_tag_ocr',
      });
    }

    // mode === 'reading'
    if (parsedData && parsedData.status === 'SUCCESS' && parsedData.readingValue !== null && parsedData.readingValue !== undefined) {
      const numVal = parseInt(String(parsedData.readingValue).replace(/[^0-9]/g, ''), 10);
      if (!isNaN(numVal) && numVal >= 0 && numVal <= 999999) {
        const formatted = String(numVal).padStart(5, '0');
        const digitsArray = parsedData.digits && Array.isArray(parsedData.digits) && parsedData.digits.length === 5 
          ? parsedData.digits 
          : formatted.split('');

        return res.json({
          success: true,
          status: 'SUCCESS',
          readingValue: numVal,
          odometerFormatted: formatted,
          digits: digitsArray,
          confidence: parsedData.confidence || 0.92,
          meterSerialDetected: meterSerial || null,
          meterCondition: parsedData.meterCondition || 'Normal',
          potentialLeak: !!parsedData.potentialLeak,
          notes: parsedData.notes || 'Mechanical dial digits identified.',
          source: 'camera_vision_ocr',
        });
      }
    }

    // If reading rejection
    return res.json({
      success: false,
      status: 'REJECTED_NO_5_DIGITS',
      readingValue: null,
      odometerFormatted: null,
      digits: [],
      confidence: parsedData?.confidence || 0,
      meterSerialDetected: meterSerial || null,
      message: 'Could not clearly identify the 5-digit meter dial. Please align the camera with the mechanical dials and ensure good lighting.',
      source: 'camera_vision_ocr',
    });
  } catch (error: any) {
    return res.json({
      success: false,
      status: 'REJECTED_NO_5_DIGITS',
      readingValue: null,
      odometerFormatted: null,
      digits: [],
      confidence: 0,
      message: 'Camera photo analysis failed. Please retake the photo or enter the reading directly.',
      source: 'camera_vision_ocr',
    });
  }
});

// Catch-all API fallback: Any unmatched /api/* or /* API route returns JSON, never HTML
app.use((err: any, req: any, res: any, next: any) => {
  console.error('[API Server Error]', err);
  res.status(500).json({
    success: false,
    error: err?.message || 'Internal Server Error',
    timestamp: new Date().toISOString(),
  });
});

app.all(['/api/*', '/api'], (req, res) => {
  res.status(404).json({
    success: false,
    error: `API route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString(),
  });
});

// Export app for Vercel Serverless Functions & testing
export default app;

// Vite Middleware Setup (only starts standalone server if not inside Vercel serverless)
async function startServer() {
  if (process.env.VERCEL || process.env.NOW_REGION || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return;
  }

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (server) {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Tagoloan Water District Meter Reader Server & WebSocket running on port ${PORT}`);
    });
  }
}

startServer();
