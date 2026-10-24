# Tagoloan Water District Mobile App - External System Connection Path

A plug-and-play **System Connection Gateway & Bridge** engineered into the mobile meter reader application, allowing field readers to connect directly to your existing utility billing/management system via configurable REST API endpoints, custom headers, active ping diagnostics, and contract specifications.

---

> [!IMPORTANT]
> **User Architectural Confirmation**:
> - **Existing System**: You already have an existing backend/management system in place.
> - **Primary Objective**: Provide a clean, robust, and configurable connection path in the mobile app so it is immediately ready to communicate with your system according to standard requirements.
> - **Field Reader Focus**: The mobile app is strictly streamlined for **meter readers only** (no consumer, staff, or admin UI clutter).
> - **Offline Resilience**: Field readings are captured locally when offline, and synced through the configured system path once connectivity is restored.

---

## 1. Overview & Core Concept

### What It Delivers
This feature creates a dedicated **System Connection Hub** inside the mobile app that bridges the field meter reader interface with your existing utility backend:
1. **Configurable Endpoint Gateway**: Set and update your existing system's Base URL (cloud domain, on-premise IP, or local server), API route prefix, and authentication headers (API Key, Bearer token, or custom header).
2. **Active Ping & Diagnostics**: Live "Test Connection" button that validates network reachability, HTTP latency, and API handshake in real time.
3. **System Requirements & API Contract Explorer**: An interactive reference within the app displaying the exact expected JSON payloads, HTTP methods, and data schemas for:
   - Consumer masterlist retrieval (`GET /consumers`)
   - Meter reading submission & batch sync (`POST /readings/batch`)
   - Reader authentication / status handshake (`POST /auth/login`)
4. **Direct Bridge Mode**: When configured, the mobile app immediately directs all network queries to your system's endpoints, with automatic fallback to local offline storage when field readers are out of cellular coverage.

### Target Persona
- **Field Meter Readers**: Operates with a clean, distraction-free UI with clear visual indicators of whether their device is currently connected to your central system or working offline.
- **System Administrator / IT Engineer**: Can open the Connection Hub, input your server's URL, test the connection, and export/import schemas without touching application code.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Accessing the System Connection Hub**:
   - The reader taps the **System Connection** gear/gateway icon in the top header (or via the side drawer).
   - The modal/screen opens with a high-contrast dark theme consistent with the rest of the application (slate-900 surface, cyan/sky accents, no white glare).

2. **Configuring Your Existing System**:
   - **Base URL Input**: Enter your existing server's base URL (e.g. `https://billing.tagoloanwaterdistrict.gov.ph` or `http://192.168.1.50:8080`).
   - **Endpoint Paths**: Optional fine-tuning for custom route mapping (e.g., `/api/consumers`, `/api/readings`, `/api/health`).
   - **Authentication**: Select Auth Type (`Bearer Token`, `API Key`, `Custom Header`, or `None / Direct`).
   - **Save & Verify**: Tap **Save Configuration**. The app stores the credentials securely in local storage.

3. **Active Ping Diagnostics**:
   - Reader or technician taps **Test Connection**.
   - The app sends an HTTP `GET` request to your health/ping path.
   - Displays immediate visual feedback:
     - 🟢 **Online (Connected)**: Shows round-trip response time (e.g., `42ms`), server status code `200 OK`, and confirmed system handshake.
     - 🔴 **Unreachable / Network Error**: Clear explanation (e.g. CORS preflight, timeout, or DNS resolution failure) with troubleshooting guidance.

4. **API Contract & Schema Inspector**:
   - The technician can switch to the **System Requirements / API Contract** tab to review the exact JSON payloads expected by the mobile client, complete with one-click **Copy JSON** and **cURL** examples to hand over to your backend developers.

### Visual Identity & Theme Tokens
- **Theme**: Deep dark mode (`bg-slate-950` chassis, `bg-slate-900` card surfaces, `border-slate-800`).
- **Accent**: Precision Cyan (`sky-400` / `sky-500`) for network activity and system status indicators.
- **Ergonomics**: All buttons and interactive inputs follow mobile touch-first guidelines with hitboxes $\ge 44\text{px}$ and zero white table flashes.

---

## 3. Key Product Decisions & Trade-Offs

| Decision | Chosen Approach | Rationale & Trade-Off |
| :--- | :--- | :--- |
| **Connection Configuration** | Client-Side Storage (`localStorage` + In-Memory Cache) with UI Manager | Allows individual reader devices or test devices to point to staging, local on-premise servers, or production without rebuilding the APK or web bundle. |
| **API Abstraction Layer** | Unified Adapter in `apiConfig.ts` & `api.ts` | The rest of the mobile app (scanning, reading entry, offline sync) interacts with abstract methods; the adapter handles targeting your custom system URL and headers. |
| **Offline-First Safeguard** | Automatic Local Cache & Batch Queue | If your system is temporarily unreachable during field operations in remote barangays, readings are never lost. They are queued locally and automatically pushed once the system path is restored. |
| **No Complex Admin Roles** | Single Field Reader Experience | As requested, extraneous staff/admin/consumer views are kept out of the field mobile interface, keeping the app focused strictly on meter readers. |

---

## 4. Technical Architecture & Data Strategy

### System Connection Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                 WDT Mobile Reader App (Frontend)             │
│                                                             │
│  ┌───────────────────────┐       ┌───────────────────────┐  │
│  │ Meter Reading Form &  │       │ System Connection Hub │  │
│  │   Camera OCR Engine   │       │   (Settings & Ping)   │  │
│  └───────────┬───────────┘       └───────────┬───────────┘  │
│              │                               │              │
│              ▼                               ▼              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           Central API Connector & Fallback            │  │
│  │              (src/services/apiConfig.ts)              │  │
│  │                                                       │  │
│  │  • Custom Base URL Dynamic Router                     │  │
│  │  • Custom Auth Header Injection (Bearer / API Key)    │  │
│  │  • Timeout & Circuit Breaker Manager                  │  │
│  └───────────┬───────────────────────────────┬───────────┘  │
│              │                               │              │
│     Offline / Blind Spot                     │ Online Path  │
│              │                               │              │
│              ▼                               ▼              │
│  ┌───────────────────────┐       ┌───────────────────────┐  │
│  │   IndexedDB / SQLite  │       │  YOUR EXISTING SYSTEM │  │
│  │   Local Vault Queue   │       │   (Central Backend)   │  │
│  └───────────────────────┘       └───────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Integration Contract Specification

Your existing system only needs to expose or support these three standard paths:

#### 1. Consumer Route Retrieval
- **Path**: `GET {BASE_URL}/api/consumers` (or custom configured path)
- **Header**: `Authorization: Bearer <TOKEN>` or `X-API-Key: <KEY>`
- **Response**: Array of consumer objects:
  ```json
  [
    {
      "accountNumber": "01-102-004",
      "name": "Maria Santos",
      "address": "Zone 2, Poblacion",
      "meterSerialNumber": "MTR-88412",
      "previousReading": 124,
      "previousReadingDate": "2026-09-15"
    }
  ]
  ```

#### 2. Reading Ingestion & Batch Push
- **Path**: `POST {BASE_URL}/api/readings/batch` (or `/api/readings`)
- **Payload**:
  ```json
  {
    "readerId": "RDR-001",
    "batchTimestamp": "2026-10-13T08:30:00Z",
    "readings": [
      {
        "accountNumber": "01-102-004",
        "currentReading": 142,
        "previousReading": 124,
        "consumption": 18,
        "readingDate": "2026-10-13",
        "gps": { "latitude": 8.5392, "longitude": 124.7501 },
        "photoUrl": "data:image/jpeg;base64,..."
      }
    ]
  ]
  ```

#### 3. System Health Probe
- **Path**: `GET {BASE_URL}/api/health`
- **Response**: `200 OK` (e.g. `{"status": "ONLINE"}`)

---

## 5. Implementation Steps

1. **System Connection Hub Screen / Drawer (`SystemConnectionModal.tsx` & enhanced `FlutterConfigScreen.tsx`)**:
   - Provide clean inputs for Base URL, API prefix, Auth Token/Key, and custom header format.
   - Built-in live connection tester displaying latency and HTTP status.
   - Contract documentation tab showing the exact JSON schemas and cURL examples for easy sharing with your backend team.

2. **Config & Adapter Refinement (`src/services/apiConfig.ts`)**:
   - Ensure dynamic base URL switching instantly updates all API calls.
   - Support custom authentication headers (`Authorization`, `X-API-KEY`, etc.).
   - Persistent configuration across app restarts.

3. **Status Indicator in Main Navigation**:
   - Subtle, unboxed visual indicator showing connection status (`Connected to System` vs `Local Vault Active`).

4. **Testing & Build Verification**:
   - Verify build compilation (`compile_applet`).
   - Test offline fallback and dynamic base URL pinging.
