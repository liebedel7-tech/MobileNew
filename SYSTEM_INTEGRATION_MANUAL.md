# Tagoloan Water District (WDT)
## Comprehensive System Integration Manual & Architecture Specification

---

### Executive Overview
The **Tagoloan Water District (WDT) Field Meter Reading & Billing System** is an offline-first, edge-computed mobile system engineered exclusively for field meter readers, backed by a Node.js/Express service and connected to the central Tagoloan Cloud Infrastructure.

This document provides the definitive, authoritative reference for:
1. The entire operational lifecycle (from registration to daily field reading and sync).
2. The network integration contract, central endpoints, base URLs, and payloads.
3. Every individual module and its precise functionality.
4. The business calculations (LWUA Category C graduated tariff).
5. The offline persistence, synchronization engine, and security rules.

---

## 1. Network Integration Contract & Connection Hub

### 1.1 Central Connection Parameters
* **Production Base URL**: `https://ais-dev-ui6fsepfskrowqsfycbac7-946013608969.asia-southeast1.run.app`
* **Local Proxy / Dev Server**: `http://localhost:3000` (Automatic fallback via `universalApiFetch`)
* **API Route Prefix**: `/api`
* **CORS Policy**: `Access-Control-Allow-Origin: *` (Full cross-origin access enabled)
* **Request Body Payload Limit**: `25MB` (Engineered specifically to accommodate high-resolution base64 camera dial snapshots)
* **Sliding Window Rate Limit**: 200 requests/minute for data endpoints; 25 requests/minute for authentication endpoints (`X-RateLimit-*` headers enabled).

### 1.2 Authentication Methods
All protected endpoints accept either of the following authentication schemes:
1. **Bearer Token (JWT)**:
   ```http
   Authorization: Bearer <token>
   ```
2. **Reader Header (Hardware / Badge ID)**:
   ```http
   x-reader-id: <badge_id>
   ```

---

### 1.3 Core System Endpoints & Payload Contracts

#### A. System Health Probe
* **Endpoint**: `GET /api/health`
* **Purpose**: Verified health check and status telemetry.
* **Response Payload (HTTP 200)**:
  ```json
  {
    "status": "online",
    "state": "ONLINE",
    "healthy": true,
    "online": true,
    "uptimeSeconds": 1420,
    "system": "Tagoloan Water District Real-Time Cloud Service",
    "district": "Tagoloan Water District",
    "code": "WDT-MISOR",
    "lwuaCategory": "Category C Water District",
    "serverTime": "2026-10-23T19:45:00.000Z",
    "totalConsumers": 26,
    "totalReadingsLogged": 14,
    "totalRegisteredReaders": 6,
    "activeReaders": 5,
    "terminatedReaders": 1,
    "wsActiveConnections": 2
  }
  ```

#### B. Consumer Route Retrieval (Masterlist Download)
* **Endpoint**: `GET /api/consumers`
* **Query Parameters (Optional)**: `?barangay=Poblacion` or `?readerId=RDR-001`
* **Headers**: `Authorization: Bearer <token>` or `x-reader-id: RDR-001`
* **Response Payload (HTTP 200)**:
  ```json
  {
    "success": true,
    "count": 7,
    "consumers": [
      {
        "id": "WDT-ACC-01042",
        "accountNumber": "011-102-056",
        "name": "FIGUEROA, GINA O.",
        "address": "SIHAYON-LEFT (ZONE-11A)",
        "barangay": "Poblacion",
        "meterSerial": "150307143",
        "meterNumber": "TAG-01042",
        "meterSize": "1/2\"",
        "category": "Residential",
        "status": "Active",
        "previousReading": 4377,
        "previousReadingDate": "2024-10-15",
        "previousConsumption": 18,
        "averageConsumption": 18,
        "rateCode": "RES-01",
        "gpsCoordinates": { "lat": 8.5392, "lng": 124.7501 },
        "routeCode": "RT-POB-04",
        "sequenceNo": 1
      }
    ]
  }
  ```

#### C. Batch Reading Ingestion (Field Upload)
* **Endpoint**: `POST /api/readings/batch`
* **Request Headers**: `Content-Type: application/json`, `Authorization: Bearer <token>`
* **Request Payload**:
  ```json
  {
    "readerId": "RDR-001",
    "batchTimestamp": "2026-10-23T08:30:00Z",
    "readings": [
      {
        "accountNumber": "011-102-056",
        "consumerId": "WDT-ACC-01042",
        "previousReading": 4377,
        "currentReading": 4400,
        "consumption": 23,
        "readingDate": "2026-10-23",
        "totalAmount": 718.50,
        "condition": "NORMAL",
        "gps": {
          "lat": 8.5392,
          "lng": 124.7501,
          "accuracy": 4.2,
          "timestamp": "2026-10-23T08:29:45Z"
        },
        "photoUrl": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...",
        "remarks": "Clean dial reading"
      }
    ]
  }
  ```
* **Response Payload (HTTP 200)**:
  ```json
  {
    "success": true,
    "message": "Successfully processed and synced 1 field readings.",
    "count": 1,
    "processedCount": 1,
    "failedCount": 0,
    "syncedIds": ["READ-47310"],
    "serverTimestamp": "2026-10-23T08:30:02.110Z"
  }
  ```

#### D. Meter Reader Authentication
* **Endpoint**: `POST /api/auth/login`
* **Request Payload**:
  ```json
  {
    "username": "jdelacruz",
    "pin": "1234"
  }
  ```
* **Response Payload (HTTP 200)**:
  ```json
  {
    "success": true,
    "user": {
      "id": "RDR-001",
      "employeeId": "TWD-2024-001",
      "username": "jdelacruz",
      "name": "Juan Dela Cruz",
      "role": "Meter Reader I",
      "zone": "Poblacion, Baluarte",
      "assignedRoutes": ["Poblacion", "Baluarte"],
      "status": "active"
    },
    "token": "wdt-jwt-UkRSLTAwMQ==-1761245000000"
  }
  ```

---

## 2. End-to-End Operational Workflow (The Right Process)

```
[METER READER LIFECYCLE]
1. Mobile Self-Registration ──► Instant Status: ACTIVE (No Approval Wait)
                                 │
                                 ▼
2. Daily Shift Start ─────────► Check Connection Hub & Pull Assigned Routes
                                 │
                                 ▼
3. Field Execution (Offline) ─► Select Consumer (Sorted by Sequence No.)
                                 ├──► Optical Camera OCR Scan (Tesseract.js)
                                 ├──► Instant LWUA Tiered Tariff Calculation
                                 ├──► Thermal Receipt Generation & GPS Stamp
                                 └──► Saved to IndexedDB (PENDING_SYNC)
                                 │
                                 ▼
4. Shift Close / Ingestion ───► Dispatch Batch Ingestion POST /api/readings/batch
                                 ├──► 25MB Body Photo Ingestion
                                 └──► WebSocket Broadcast to District Ledger

[ADMINISTRATOR LIFECYCLE]
- Directory Oversight ────────► Observes Active Roster in Real-time
- Single Authority Action ────► TERMINATE METER READER (Revokes Access & Mobile Lockout)
```

### Step 1: Self-Registration with Automatic Activation
1. A meter reader opens the mobile terminal app and clicks **Register**.
2. They enter Full Name, Employee ID, Username, Security PIN, and select their coverage barangay(s).
3. The system checks route occupancy to avoid duplicate assignments.
4. **Immediate Provisioning**: The account is assigned `status: 'active'` immediately.
5. **Zero Bottleneck**: The user is directly logged in and forwarded to the field terminal without waiting for supervisor review.

### Step 2: Route Synchronization
1. At the start of the billing period, the reader connects to Wi-Fi/cellular.
2. In the **System Connection Hub**, they pull the consumer route masterlist.
3. Consumers for their assigned barangays are saved to local IndexedDB storage.
4. The application is now **100% autonomous and offline-ready**.

### Step 3: Field Reading & Billing
1. The meter reader navigates their assigned sequence in Tagoloan (e.g., Sitio Sihayon, Poblacion).
2. For each consumer:
   - Tap **Scan Meter**: Point device camera at the physical dial.
   - Built-in LED torch activates for dark meter enclosures.
   - On-device Tesseract.js WASM engine reads dial digits.
   - Or, manually type the numerical reading in the **Reading Entry** screen.
3. The system automatically computes:
   - Consumption = `Current Reading - Previous Reading`
   - High/Low/Zero consumption validation flags.
   - Instant LWUA Category C graduated rate calculation.
   - Senior Citizen (RA 9994) 5% discount if flagged.
4. GPS coordinates and photo snapshot are captured.
5. The reading is saved locally in IndexedDB with status `PENDING_SYNC`.
6. An on-site thermal receipt bill is printed/previewed for the consumer.

### Step 4: Batch Ingestion & Office Ledger Sync
1. At the end of the route (or whenever cell signal is available), open **Batch Submission**.
2. Tap **Upload Batch Readings**.
3. All buffered readings, along with high-res dial photos and GPS stamps, are transmitted to `POST /api/readings/batch`.
4. The central system updates consumer previous readings and logs audit records.
5. Live WebSocket events notify the central web office dashboard in real time.

### Step 5: Administrator Authority (Single-Option Governance)
* Administrators do not approve accounts because registration is self-service and auto-active.
* The administrator's sole supervisory enforcement action is **Terminate Meter Reader**.
* Terminating an account:
  - Immediately blocks the reader's credentials on `/api/auth/login` (HTTP 403).
  - Pushes a real-time `READER_ACCOUNT_TERMINATED` WebSocket event.
  - Revokes batch submission acceptance.
  - Releases their assigned barangay for other meter readers.

---

## 3. Comprehensive Module Inventory & Functionalities

| # | Screen / Module | Primary File | Core Functionality |
|---|---|---|---|
| 1 | **Field Portal Landing** | `src/screens/LandingScreen.tsx` | Entry gateway, official district branding, real-time connection status pill, direct Sign In / Register buttons, and WebAPK install prompt. |
| 2 | **Authentication & Register** | `src/screens/LoginScreen.tsx` | PIN & username credential validation, instant self-registration with automatic terminal activation, route occupancy conflict checking, and terminated account lockout. |
| 3 | **Field Terminal Dashboard** | `src/screens/DashboardScreen.tsx` | Shift metrics overview (Total Assigned, Completed, Unread, % Progress), quick-action module launchpad, sync alert bar, and recent readings stream. |
| 4 | **Consumer Route Masterlist** | `src/screens/ConsumersScreen.tsx` | Route list filtered by Tagoloan's 10 barangays, search by account/meter/name, read/unread filters, and sequential route navigation. |
| 5 | **Consumer Profile Inspection** | `src/screens/ConsumerDetailsScreen.tsx` | Deep consumer metadata inspection, past consumption averages, rate code verification, GPS coordinates, and quick transition to reading entry. |
| 6 | **Reading Entry & Calculator** | `src/screens/ReadingEntryScreen.tsx` | Manual reading input, delta calculation, LWUA volumetric tariff computation, anomaly warnings (stuck dial, fogged glass, high consumption), camera capture, and printable thermal receipt bill simulation. |
| 7 | **Camera OCR Dial Scanner** | `src/screens/ScanMeterScreen.tsx` | Hardware camera stream (`getUserMedia`), flashlight torch control, HTML5 canvas pre-processing, and client-side Tesseract.js WASM OCR dial digit extraction. |
| 8 | **Batch Submission Sync Hub** | `src/screens/BatchSubmissionScreen.tsx` | Buffer queue manager for offline readings, photo preview, GPS audit check, and atomic bulk upload to `POST /api/readings/batch`. |
| 9 | **Reading History & Slips** | `src/screens/HistoryScreen.tsx` | Chronological record of completed readings for the billing cycle, print receipt regeneration, and data export. |
| 10 | **Audit Log & Security Trail** | `src/screens/AuditLogScreen.tsx` | Immutable chronological ledger of all system events: logins, registrations, readings, batch uploads, and account terminations. |
| 11 | **Meter Readers Directory** | `src/screens/MeterReadersScreen.tsx` | Administrative personnel roster, real-time presence indicators, coverage route views, and the administrator's single action: **Terminate Meter Reader**. |
| 12 | **System Connection Hub** | `src/screens/SystemConnectionScreen.tsx` | Central API endpoint configurator, Base URL selector, Bearer token / Header generator, live endpoint test runner, route pull, and batch push tool. |
| 13 | **Security & Defense Terminal**| `src/screens/ArchitectureSecurityScreen.tsx`| Sliding-window rate limiter monitor, interactive bot flood simulation (up to 10k requests), and system resilience diagnostics. |
| 14 | **Diagnostic & Debug Deck** | `src/screens/DebugScreen.tsx` | Low-level developer tools, WebSocket live stream monitor, IndexedDB inspection/clearing, and manual route seed dispatch. |

---

## 4. LWUA Category C Volumetric Billing Calculations

Tagoloan Water District operates under Category C Water District billing rules (`src/utils/billingCalculator.ts`):

### 4.1 Residential Tariff Table (1/2" Connection)
* **Minimum Charge (0 – 10 cu.m.)**: `₱205.00` flat minimum
* **Commodity Tier 1 (11 – 20 cu.m.)**: `₱22.50` per cu.m.
* **Commodity Tier 2 (21 – 30 cu.m.)**: `₱26.00` per cu.m.
* **Commodity Tier 3 (31 – 40 cu.m.)**: `₱31.25` per cu.m.
* **Commodity Tier 4 (41+ cu.m.)**: `₱36.50` per cu.m.
* **Meter Maintenance Fee**: `₱10.00` flat monthly fee

### 4.2 Calculation Formula
For a residential consumption of $C$ cu.m.:
1. If $C \le 10$: $\text{Basic Charge} = 205.00$
2. If $11 \le C \le 20$: $\text{Basic Charge} = 205.00 + (C - 10) \times 22.50$
3. If $21 \le C \le 30$: $\text{Basic Charge} = 205.00 + (10 \times 22.50) + (C - 20) \times 26.00$
4. If $31 \le C \le 40$: $\text{Basic Charge} = 205.00 + (10 \times 22.50) + (10 \times 26.00) + (C - 30) \times 31.25$
5. If $C > 40$: $\text{Basic Charge} = 205.00 + (10 \times 22.50) + (10 \times 26.00) + (10 \times 31.25) + (C - 40) \times 36.50$

$$\text{Subtotal} = \text{Basic Charge} + 10.00 \text{ (Maintenance Fee)}$$

### 4.3 Senior Citizen Discount (RA 9994)
* Criteria: Consumption $\le 30$ cu.m. and registered senior citizen.
* Discount = $\text{Basic Charge} \times 5\%$.

### 4.4 Overdue Penalty
* Surcharge = $10\%$ of Total Current Amount if unpaid after the due date (15 days from reading).

---

## 5. Offline Storage & Hardware Integration

### 5.1 IndexedDB Schema (`DatabaseHelper.ts`)
* Database Name: `WDT_MeterReader_DB_v2` (Version 1)
* Object Stores:
  1. `consumers` (Key: `id`, Indexes: `accountNumber`, `meterSerial`, `barangay`, `routeCode`)
  2. `readings` (Key: `id`, Indexes: `consumerId`, `accountNumber`, `status`, `readingDate`)
  3. `audit_logs` (Key: `id`, Indexes: `action`, `timestamp`)

### 5.2 Client OCR & Vision (`Tesseract.js`)
* Runs entirely on a dedicated Web Worker thread to preserve 60 FPS UI responsiveness.
* Uses whitelist filter `0123456789` with regular expression matching to isolate physical counter roller tumblers.
* Automatically captures camera feed snapshots at $1280 \times 720$ resolution with dynamic brightness/contrast canvas preprocessing.

---

## 6. Summary Checklist for Mobile Team Deployment

1. **Point Base URL**: Set to `https://ais-dev-ui6fsepfskrowqsfycbac7-946013608969.asia-southeast1.run.app` with prefix `/api`.
2. **Authenticate**: Login via `POST /api/auth/login` or register with automatic activation. Pass returned Bearer token in the `Authorization` header.
3. **Download Routes**: Invoke `GET /api/consumers` to seed the local database.
4. **Field Execution**: Record readings offline with GPS stamps and photo proofs.
5. **Batch Upload**: Submit completed routes via `POST /api/readings/batch`.
