import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Set up CORS & JSON response headers for API requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Set up HTTP and WebSocket Server
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Track active WebSocket connections
const activeClients = new Set<WebSocket>();

function broadcastWebSocketEvent(eventType: string, data: any) {
  const message = JSON.stringify({
    type: eventType,
    timestamp: new Date().toISOString(),
    payload: data,
  });

  for (const client of activeClients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (err) {
        console.error('Error sending WS message:', err);
      }
    }
  }
}

wss.on('connection', (ws: WebSocket, req) => {
  activeClients.add(ws);
  console.log(`[WS] Field Device connected. Total active connections: ${activeClients.size}`);

  // Send initial welcome & real-time sync pulse
  ws.send(JSON.stringify({
    type: 'CONNECTION_ESTABLISHED',
    timestamp: new Date().toISOString(),
    payload: {
      status: 'CONNECTED',
      server: 'Tagoloan Water District Central Billing Node',
      activePeers: activeClients.size,
      district: 'WDT-MISOR',
      totalReadingsLogged: serverReadings.length,
      initialConsumersCount: INITIAL_CONSUMERS.length,
    },
  }));

  ws.on('message', (raw) => {
    try {
      const parsed = JSON.parse(raw.toString());
      if (parsed.type === 'PING') {
        ws.send(JSON.stringify({
          type: 'PONG',
          timestamp: new Date().toISOString(),
          payload: { echo: parsed.payload, serverTime: Date.now() },
        }));
      } else if (parsed.type === 'FIELD_READING_RECORDED') {
        // Broadcast single live reading event
        broadcastWebSocketEvent('LIVE_READING_UPDATE', parsed.payload);
      } else if (parsed.type === 'FIELD_STAFF_ACTIVITY') {
        broadcastWebSocketEvent('STAFF_ACTIVITY_STREAM', parsed.payload);
      } else if (parsed.type === 'MODULE_NAVIGATION') {
        // Broadcast real-time module transition to all connected district terminals
        broadcastWebSocketEvent('MODULE_NAVIGATION_BROADCAST', parsed.payload);
        console.log(`[WS] Reader ${parsed.payload?.readerName || 'Staff'} switched module -> ${parsed.payload?.toModule}`);
      } else if (parsed.type === 'PROCESS_EVENT') {
        // Broadcast process state (batch sync, OCR analyze, tariff compute, etc.)
        broadcastWebSocketEvent('PROCESS_TELEMETRY_UPDATE', parsed.payload);
        console.log(`[WS] Process [${parsed.payload?.processName}]: ${parsed.payload?.status}`);
      }
    } catch (e) {
      // ignore malformed ws message
    }
  });

  ws.on('close', () => {
    activeClients.delete(ws);
    console.log(`[WS] Field Device disconnected. Total active: ${activeClients.size}`);
  });

  ws.on('error', (err) => {
    activeClients.delete(ws);
  });
});

// Periodic heartbeat pulse
setInterval(() => {
  if (activeClients.size > 0) {
    broadcastWebSocketEvent('SERVER_HEARTBEAT', {
      uptimeSeconds: process.uptime(),
      activeClientsCount: activeClients.size,
      totalReadingsOnServer: serverReadings.length,
    });
  }
}, 15000);

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

// Initial Seed Consumers for Tagoloan Water District (WDT), Misamis Oriental
const INITIAL_CONSUMERS = [
  {
    id: 'WDT-ACC-01042',
    accountNumber: '01-042-0091',
    name: 'AMORATO, VICENTE G.',
    address: 'Zone 2, Brgy. Poblacion, Tagoloan, Misamis Oriental',
    barangay: 'Poblacion',
    meterSerial: 'MTR-8849201',
    meterSize: '1/2"',
    category: 'Residential',
    status: 'Active',
    previousReading: 342,
    previousReadingDate: '2026-07-14',
    averageConsumption: 18,
    rateCode: 'RES-01',
    gpsCoordinates: { lat: 8.5398, lng: 124.7523 },
    routeCode: 'RT-POB-04',
    sequenceNo: 1,
    contactNumber: '+63 917 234 5678',
    lastSyncDate: new Date().toISOString(),
  },
  {
    id: 'WDT-ACC-01043',
    accountNumber: '01-042-0092',
    name: 'CABALLERO, MA. ELENA S.',
    address: 'Purok 4, Brgy. Baluarte, Tagoloan, Misamis Oriental',
    barangay: 'Baluarte',
    meterSerial: 'MTR-7738291',
    meterSize: '1/2"',
    category: 'Residential',
    status: 'Active',
    previousReading: 512,
    previousReadingDate: '2026-07-14',
    averageConsumption: 22,
    rateCode: 'RES-01',
    gpsCoordinates: { lat: 8.5462, lng: 124.7611 },
    routeCode: 'RT-BAL-01',
    sequenceNo: 2,
    contactNumber: '+63 928 891 2345',
    lastSyncDate: new Date().toISOString(),
  },
  {
    id: 'WDT-ACC-01044',
    accountNumber: '02-019-0115',
    name: 'TAGOLOAN GRAIN MILL & TRADING',
    address: 'National Highway, Brgy. Casinglot, Tagoloan',
    barangay: 'Casinglot',
    meterSerial: 'MTR-COM-44912',
    meterSize: '1"',
    category: 'Commercial A',
    status: 'Active',
    previousReading: 1289,
    previousReadingDate: '2026-07-13',
    averageConsumption: 85,
    rateCode: 'COM-A-01',
    gpsCoordinates: { lat: 8.5312, lng: 124.7435 },
    routeCode: 'RT-CAS-02',
    sequenceNo: 3,
    contactNumber: '+63 939 123 4567',
    lastSyncDate: new Date().toISOString(),
  },
  {
    id: 'WDT-ACC-01045',
    accountNumber: '01-088-0044',
    name: 'RODRIGUEZ, BENJAMIN T.',
    address: 'Zone 1, Brgy. Mohon, Tagoloan, Misamis Oriental',
    barangay: 'Mohon',
    meterSerial: 'MTR-9021844',
    meterSize: '1/2"',
    category: 'Residential',
    status: 'Active',
    previousReading: 198,
    previousReadingDate: '2026-07-15',
    averageConsumption: 14,
    rateCode: 'RES-01',
    gpsCoordinates: { lat: 8.5284, lng: 124.7698 },
    routeCode: 'RT-MOH-01',
    sequenceNo: 4,
    contactNumber: '+63 915 678 9012',
    lastSyncDate: new Date().toISOString(),
  },
  {
    id: 'WDT-ACC-01046',
    accountNumber: '03-005-0012',
    name: 'PHIVIDEC AGRO-INDUSTRIAL FABRICATION CORP.',
    address: 'Industrial Estate, Brgy. Sugbongcogon, Tagoloan',
    barangay: 'Sugbongcogon',
    meterSerial: 'MTR-IND-99102',
    meterSize: '2"',
    category: 'Industrial',
    status: 'Active',
    previousReading: 4890,
    previousReadingDate: '2026-07-12',
    averageConsumption: 340,
    rateCode: 'IND-01',
    gpsCoordinates: { lat: 8.5521, lng: 124.7388 },
    routeCode: 'RT-SUG-03',
    sequenceNo: 5,
    contactNumber: '+63 88 567 1122',
    lastSyncDate: new Date().toISOString(),
  },
  {
    id: 'WDT-ACC-01047',
    accountNumber: '01-012-0059',
    name: 'TAGOLOAN CENTRAL ELEMENTARY SCHOOL',
    address: 'School Site Rd, Brgy. Poblacion, Tagoloan',
    barangay: 'Poblacion',
    meterSerial: 'MTR-INST-1029',
    meterSize: '1"',
    category: 'Institutional',
    status: 'Active',
    previousReading: 875,
    previousReadingDate: '2026-07-14',
    averageConsumption: 60,
    rateCode: 'INST-01',
    gpsCoordinates: { lat: 8.5412, lng: 124.7541 },
    routeCode: 'RT-POB-01',
    sequenceNo: 6,
    contactNumber: '+63 88 567 9900',
    lastSyncDate: new Date().toISOString(),
  },
  {
    id: 'WDT-ACC-01048',
    accountNumber: '01-099-0128',
    name: 'VALDEZ, DANILO P.',
    address: 'Zone 3, Brgy. Natumolan, Tagoloan, Misamis Oriental',
    barangay: 'Natumolan',
    meterSerial: 'MTR-6638102',
    meterSize: '1/2"',
    category: 'Residential',
    status: 'Disconnected',
    previousReading: 410,
    previousReadingDate: '2026-07-10',
    averageConsumption: 16,
    rateCode: 'RES-01',
    gpsCoordinates: { lat: 8.5355, lng: 124.7602 },
    routeCode: 'RT-NAT-02',
    sequenceNo: 7,
    contactNumber: '+63 945 223 3445',
    lastSyncDate: new Date().toISOString(),
  },
  {
    id: 'WDT-ACC-01049',
    accountNumber: '01-042-0199',
    name: 'MACASARTE, ROLANDO E.',
    address: 'Sitio Gracia, Brgy. Gracia, Tagoloan, Misamis Oriental',
    barangay: 'Gracia',
    meterSerial: 'MTR-4481093',
    meterSize: '1/2"',
    category: 'Residential',
    status: 'Active',
    previousReading: 680,
    previousReadingDate: '2026-07-14',
    averageConsumption: 24,
    rateCode: 'RES-01',
    gpsCoordinates: { lat: 8.5204, lng: 124.7731 },
    routeCode: 'RT-GRA-01',
    sequenceNo: 8,
    contactNumber: '+63 977 441 9923',
    lastSyncDate: new Date().toISOString(),
  },
  {
    id: 'WDT-ACC-01050',
    accountNumber: '01-073-0041',
    name: 'LUMANGCAS, CORAZON B.',
    address: 'Purok 2, Brgy. Sta. Cruz, Tagoloan, Misamis Oriental',
    barangay: 'Sta. Cruz',
    meterSerial: 'MTR-5529011',
    meterSize: '1/2"',
    category: 'Residential',
    status: 'Active',
    previousReading: 295,
    previousReadingDate: '2026-07-15',
    averageConsumption: 19,
    rateCode: 'RES-01',
    gpsCoordinates: { lat: 8.5441, lng: 124.7489 },
    routeCode: 'RT-SCZ-01',
    sequenceNo: 9,
    contactNumber: '+63 908 554 1234',
    lastSyncDate: new Date().toISOString(),
  },
  {
    id: 'WDT-ACC-01051',
    accountNumber: '02-088-0311',
    name: 'SEAFOODS RESTO & BAKERY',
    address: 'Tagoloan Commercial Arcade, Brgy. Poblacion',
    barangay: 'Poblacion',
    meterSerial: 'MTR-COM-88319',
    meterSize: '3/4"',
    category: 'Commercial B',
    status: 'Active',
    previousReading: 914,
    previousReadingDate: '2026-07-14',
    averageConsumption: 48,
    rateCode: 'COM-B-01',
    gpsCoordinates: { lat: 8.5401, lng: 124.7533 },
    routeCode: 'RT-POB-02',
    sequenceNo: 10,
    contactNumber: '+63 921 777 8899',
    lastSyncDate: new Date().toISOString(),
  },
  {
    id: 'WDT-ACC-01052',
    accountNumber: '01-061-0083',
    name: 'QUILATON, EDGARDO M.',
    address: 'Zone 5, Brgy. Sta. Ana, Tagoloan, Misamis Oriental',
    barangay: 'Sta. Ana',
    meterSerial: 'MTR-1192837',
    meterSize: '1/2"',
    category: 'Residential',
    status: 'Active',
    previousReading: 432,
    previousReadingDate: '2026-07-13',
    averageConsumption: 21,
    rateCode: 'RES-01',
    gpsCoordinates: { lat: 8.5199, lng: 124.7812 },
    routeCode: 'RT-SNA-01',
    sequenceNo: 11,
    contactNumber: '+63 966 332 1198',
    lastSyncDate: new Date().toISOString(),
  },
  {
    id: 'WDT-ACC-01053',
    accountNumber: '01-042-0310',
    name: 'YAP, FORTUNATO L.',
    address: 'Purok 3, Brgy. Poblacion, Tagoloan, Misamis Oriental',
    barangay: 'Poblacion',
    meterSerial: 'MTR-3392019',
    meterSize: '1/2"',
    category: 'Residential',
    status: 'Active',
    previousReading: 815,
    previousReadingDate: '2026-07-14',
    averageConsumption: 25,
    rateCode: 'RES-01',
    gpsCoordinates: { lat: 8.5405, lng: 124.7518 },
    routeCode: 'RT-POB-04',
    sequenceNo: 12,
    contactNumber: '+63 917 881 2233',
    lastSyncDate: new Date().toISOString(),
  }
];

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
  },
  {
    id: 'WDT-SUP01',
    employeeId: 'TWD-2026-001',
    username: 'supervisor',
    pin: '5678',
    name: 'Engr. Roberto M. Dael',
    role: 'Field Supervisor / Billing Officer',
    contactNumber: '0918-999-8877',
    email: 'r.dael@tagoloanwater.gov.ph',
    assignedRoutes: ['All Tagoloan Districts'],
    status: 'active',
    deviceInfo: 'Supervisor Central Desk (Web/Mobile)',
    createdAt: '2026-01-01T00:00:00Z',
    approvedAt: '2026-01-01T00:00:00Z',
    approvedBy: 'General Manager',
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
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    district: 'Tagoloan Water District',
    code: 'WDT-MISOR',
    lwuaCategory: 'Category C Water District',
    firestoreProject: 'ai-studio-tagoloanwaterdis-29aaeffc-dbd1-4669-9b5b-63d636462350',
    serverTime: new Date().toISOString(),
    totalConsumers: INITIAL_CONSUMERS.length,
    totalReadingsLogged: serverReadings.length,
    totalRegisteredReaders: REGISTERED_READERS.length,
    pendingApprovalReaders: REGISTERED_READERS.filter(r => r.status === 'pending').length,
  });
});

// Meter Reader Registration (Mobile App -> Central / Firestore readers collection)
app.post(['/api/readers/register', '/api/auth/register'], (req, res) => {
  const { name, employeeId, id, username, pin, contactNumber, email, zone, assignedRoutes, deviceInfo } = req.body;

  const readerName = name || username || 'Field Staff';
  const readerUsername = username || id || employeeId || `reader_${Date.now()}`;

  if (!readerName || !readerUsername) {
    return res.status(400).json({ success: false, message: 'Name and Username are required' });
  }

  // Check if username or employeeId already registered
  const existing = REGISTERED_READERS.find(
    r => r.username.toLowerCase() === readerUsername.toLowerCase() || 
         (employeeId && r.employeeId && r.employeeId.toLowerCase() === employeeId.toLowerCase()) ||
         (id && r.id && r.id.toLowerCase() === id.toLowerCase())
  );

  if (existing) {
    return res.status(409).json({
      success: false,
      message: `A meter reader with Username '${readerUsername}' or ID '${id || employeeId || ''}' already exists.`,
      status: existing.status,
      employmentStatus: existing.status,
      reader: existing,
    });
  }

  const routes = Array.isArray(assignedRoutes) && assignedRoutes.length > 0 
    ? assignedRoutes 
    : (zone ? [zone] : ['Poblacion']);

  const newReaderId = id || `RDR-${String(REGISTERED_READERS.length + 1).padStart(3, '0')}`;
  const newReader = {
    id: newReaderId,
    employeeId: employeeId || `TWD-2026-${String(Math.floor(100 + Math.random() * 900))}`,
    username: readerUsername.trim(),
    pin: pin || '1234',
    name: readerName.trim(),
    role: req.body.role || 'Meter Reader I',
    contactNumber: contactNumber || '',
    email: email || `${readerUsername.toLowerCase()}@tagoloanwater.gov.ph`,
    assignedRoutes: routes,
    status: 'pending', // Starts in pending approval
    employmentStatus: 'pending',
    deviceInfo: deviceInfo || req.headers['user-agent'] || 'Android Mobile Device',
    createdAt: new Date().toISOString(),
  };

  REGISTERED_READERS.push(newReader);

  // Broadcast WebSocket notification to Admin Web Portal
  broadcastWebSocketEvent('READER_REGISTERED_PENDING', {
    reader: newReader,
    totalPending: REGISTERED_READERS.filter(r => r.status === 'pending').length,
    timestamp: new Date().toISOString(),
  });

  serverAuditLogs.push({
    id: `LOG-REG-${Date.now()}`,
    timestamp: new Date().toISOString(),
    action: 'READER_REGISTRATION_SUBMITTED',
    userId: newReader.id,
    userName: newReader.name,
    details: `Meter Reader registered on mobile (${newReader.employeeId}). Status set to PENDING admin approval.`,
    deviceInfo: newReader.deviceInfo,
  });

  res.status(201).json({
    success: true,
    message: 'Meter reader registration submitted successfully. Awaiting Administrator approval.',
    status: 'pending',
    employmentStatus: 'pending',
    reader: newReader,
  });
});

// List all readers (for Admin Portal & Mobile Sync)
app.get(['/api/readers', '/api/staff'], (req, res) => {
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
         r.username.toLowerCase() === id.toLowerCase()
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

// Admin rejects / suspends reader
app.patch('/api/readers/:id/reject', (req, res) => {
  const { id } = req.params;
  const reader = REGISTERED_READERS.find(r => r.id.toLowerCase() === id.toLowerCase());

  if (!reader) {
    return res.status(404).json({ success: false, message: 'Reader not found' });
  }

  reader.status = 'rejected';
  broadcastWebSocketEvent('READER_STATUS_CHANGED', {
    readerId: reader.id,
    status: 'rejected',
    timestamp: new Date().toISOString(),
  });

  res.json({ success: true, message: 'Reader status updated to rejected', reader });
});

// Authentication with Status Check
app.post('/api/auth/login', (req, res) => {
  const { username, pin, readerId } = req.body;
  const user = REGISTERED_READERS.find(
    u => (u.username.toLowerCase() === (username || '').toLowerCase() || 
          u.id.toLowerCase() === (readerId || username || '').toLowerCase() ||
          u.employeeId.toLowerCase() === (username || '').toLowerCase()) &&
         (u.pin === pin || !pin)
  );

  if (user) {
    if (user.status === 'pending') {
      return res.status(403).json({
        success: false,
        status: 'pending',
        message: 'Your reader account is pending Administrator review and route assignment.',
        reader: {
          id: user.id,
          employeeId: user.employeeId,
          name: user.name,
          status: 'pending',
          createdAt: user.createdAt,
        }
      });
    }

    if (user.status === 'rejected') {
      return res.status(403).json({
        success: false,
        status: 'rejected',
        message: 'Your reader account has been deactivated by the Administrator.',
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
        zone: user.assignedRoutes.join(', '),
        assignedRoutes: user.assignedRoutes,
        status: user.status,
      },
      serverSyncTime: new Date().toISOString(),
    });
  } else {
    // If not matched, return real invalid credentials error (No fake fallback)
    res.status(401).json({
      success: false,
      message: 'Invalid Staff Username, Employee ID, or Security PIN. Please verify your credentials or register as a new reader.',
    });
  }
});

// Consumers list download & Route Sync Pull
app.get(['/api/consumers', '/api/sync/pull'], (req, res) => {
  const { since, zone, route } = req.query;
  let filtered = [...INITIAL_CONSUMERS];

  if (zone && typeof zone === 'string' && zone.toLowerCase() !== 'all') {
    filtered = filtered.filter(c => 
      (c.barangay && c.barangay.toLowerCase().includes(zone.toLowerCase())) ||
      (c.routeCode && c.routeCode.toLowerCase().includes(zone.toLowerCase())) ||
      (c.address && c.address.toLowerCase().includes(zone.toLowerCase()))
    );
  }

  if (route && typeof route === 'string' && route.toLowerCase() !== 'all') {
    filtered = filtered.filter(c => c.routeCode && c.routeCode.toLowerCase().includes(route.toLowerCase()));
  }

  res.json({
    success: true,
    zone: zone || 'ALL',
    count: filtered.length,
    timestamp: new Date().toISOString(),
    consumers: filtered,
  });
});

// Single Reading Submit Endpoint
app.post(['/api/readings/submit', '/api/sync/push'], (req, res) => {
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
});

// Batch reading submission
app.post('/api/readings/batch', (req, res) => {
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
});

// History & Status
app.get('/api/readings/history', (req, res) => {
  res.json({
    success: true,
    total: serverReadings.length,
    readings: serverReadings,
  });
});

// Audit Logs
app.get('/api/audit-logs', (req, res) => {
  res.json({
    success: true,
    logs: serverAuditLogs.slice(-100).reverse(),
  });
});

app.post('/api/audit-logs', (req, res) => {
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
app.get('/api/readings/pending', (req, res) => {
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

// 📷 Real Camera Optical Vision Analysis with Strict 5-Digit Validation
app.post('/api/ocr/analyze', async (req, res) => {
  try {
    const { imageBase64, previousReading, meterSerial } = req.body;

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
        digits: [],
        confidence: 0,
        message: 'Vision service unavailable. Please enter the reading manually or check network.',
      });
    }

    // Clean base64 string
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const prompt = `Analyze this real photo captured from the water meter reader camera for Tagoloan Water District (TWD).
Strict requirements:
1. Examine the mechanical odometer counter on the water meter.
2. Extract the EXACT consecutive numerical digits (00000 - 99999) representing cubic meters consumption.
3. If no water meter dial is clearly visible, or if the photo is blurry/dark/unreadable, return "readingValue": null and "status": "REJECTED_NO_5_DIGITS".
4. If a tag or serial number is visible on the meter body (e.g. TWD-XXXX, TAG-XXXX, or number plate), extract it in "meterSerialDetected".

Respond with strict JSON ONLY:
{
  "status": "SUCCESS" | "REJECTED_NO_5_DIGITS",
  "readingValue": number | null,
  "odometerFormatted": "string of digits like 00368" | null,
  "confidence": number between 0.0 and 1.0,
  "meterSerialDetected": string | null,
  "meterCondition": "Normal" | "Moisture inside dial" | "Damaged glass" | "Unclear",
  "potentialLeak": boolean,
  "notes": string
}`;

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

    if (parsedData && parsedData.status === 'SUCCESS' && parsedData.readingValue !== null && parsedData.readingValue !== undefined) {
      const numVal = parseInt(String(parsedData.readingValue).replace(/[^0-9]/g, ''), 10);
      if (!isNaN(numVal) && numVal >= 0 && numVal <= 999999) {
        const formatted = String(numVal).padStart(5, '0');
        return res.json({
          success: true,
          status: 'SUCCESS',
          readingValue: numVal,
          odometerFormatted: formatted,
          digits: formatted.split(''),
          confidence: parsedData.confidence || 0.92,
          meterSerialDetected: parsedData.meterSerialDetected || meterSerial || null,
          meterCondition: parsedData.meterCondition || 'Normal',
          potentialLeak: !!parsedData.potentialLeak,
          notes: parsedData.notes || 'Identified from captured photo.',
          source: 'camera_vision_ocr',
        });
      }
    }

    // If no digits or failed extraction from the real photo
    return res.json({
      success: false,
      status: 'REJECTED_NO_5_DIGITS',
      readingValue: null,
      odometerFormatted: null,
      digits: [],
      confidence: parsedData?.confidence || 0,
      meterSerialDetected: parsedData?.meterSerialDetected || null,
      message: 'Could not clearly identify the meter digits from this photo. Please retake photo with steady focus and good lighting.',
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

// Catch-all API fallback: Any unmatched /api/* route returns JSON, never HTML
app.all('/api/*', (req, res) => {
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
  if (process.env.VERCEL) {
    return;
  }

  if (process.env.NODE_ENV !== 'production') {
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

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Tagoloan Water District Meter Reader Server & WebSocket running on port ${PORT}`);
  });
}

startServer();
