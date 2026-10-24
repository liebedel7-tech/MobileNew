# Tagoloan Water District (WDT)
## Operational Workflow & Module Directory

---

## 1. System Modules Directory

### A. Core Field Operation Modules

#### 1. Field Portal Landing (`src/screens/LandingScreen.tsx`)
* **Role**: Primary welcome gate for field personnel.
* **Key Features**:
  - Real-time connection badge (WebSocket and Central Server heartbeat).
  - Quick System Specs readout (Latency, Buffer count, Active Peers).
  - Direct actions: **Sign In**, **Register**, and **Install / Download Mobile App** (PWA/WebAPK prompt).
  - 3D interactive holographic card with district insignia.

#### 2. Authentication & Self-Registration (`src/screens/LoginScreen.tsx`)
* **Role**: Credential exchange and reader onboarding.
* **Key Features**:
  - **Instant Terminal Activation**: Registered meter readers bypass approval queues and start duty immediately.
  - Coverage Area conflict resolution: Real-time checks prevent overlapping assignments of Tagoloan's 10 barangays.
  - Security PIN visibility toggle.
  - Terminated account lockout (`HTTP 403: Account terminated by district administration`).

#### 3. Field Terminal Dashboard (`src/screens/DashboardScreen.tsx`)
* **Role**: Shift command center.
* **Key Features**:
  - Live progress rings: Total Assigned vs Read Count vs Remaining Consumers.
  - Percentage progress bar.
  - Quick Launch cards: **Consumer Route**, **Batch Upload**, **Scan Meter**, **Reading Entry**.
  - Un-synced readings alert badge.
  - Recent readings feed with instant bill print trigger.

#### 4. Consumer Route Masterlist (`src/screens/ConsumersScreen.tsx`)
* **Role**: Sequential route navigation.
* **Key Features**:
  - Barangay selector: Filter by Poblacion, Baluarte, Casinglot, Mohon, Natumolan, Sta. Cruz, Sta. Ana, Sugbongcogon, Gracia, Rosario.
  - Live search by Account Number, Meter Serial Number, or Consumer Name.
  - Status filters: All, Unread, Read, Flagged/Anomaly.
  - Direct entry point into camera scan or manual entry for any account.

#### 5. Consumer Details Profile (`src/screens/ConsumerDetailsScreen.tsx`)
* **Role**: Deep metadata and historical review.
* **Key Features**:
  - Consumer classification (Residential, Commercial, Industrial).
  - Meter Serial Tag and physical size (e.g. 1/2").
  - Past 6-month consumption volume and billing average.
  - GPS coordinates with pin mapping.

#### 6. Reading Entry & Calculator (`src/screens/ReadingEntryScreen.tsx`)
* **Role**: Dial logging and on-site billing calculation.
* **Key Features**:
  - Live consumption volume computation ($C = \text{Current} - \text{Previous}$).
  - 0ms LWUA Category C graduated tariff calculation.
  - Senior citizen discount toggle (5% off basic charge).
  - Meter condition tagger: `NORMAL`, `GLASS_FOGGED`, `STUCK_DIAL`, `DAMAGED`, `LEAK_SUSPECTED`.
  - Camera dial snapshot capture.
  - On-site thermal receipt simulation and Bluetooth printer dispatch.

#### 7. Optical Character Recognition (OCR) Scanner (`src/screens/ScanMeterScreen.tsx`)
* **Role**: Vision-based dial reader.
* **Key Features**:
  - Fullscreen viewfinder stream using HTML5 `MediaDevices`.
  - Hardware flashlight (torch) toggle for nocturnal and enclosed readings.
  - Canvas contrast and threshold preprocessing.
  - On-device Tesseract.js WebAssembly OCR engine (works 100% offline).

#### 8. Batch Submission Hub (`src/screens/BatchSubmissionScreen.tsx`)
* **Role**: Offline buffer manager and bulk upload.
* **Key Features**:
  - Inspection table of queued readings with photo previews and GPS coordinates.
  - Atomic batch payload submission (`POST /api/readings/batch`).
  - Automatic error isolation (failed records remain queued; successful records marked SYNCED).

---

### B. Administrative & System Modules

#### 9. Meter Readers Directory & Governance (`src/screens/MeterReadersScreen.tsx`)
* **Role**: Administrator workforce management.
* **Key Features**:
  - Real-time roster of all field personnel.
  - Status indicators: **ACTIVE IN FIELD** vs **TERMINATED**.
  - **Single Authority Control**: Administrator holds one primary authority action: **"Terminate Meter Reader"**.
  - Terminating an account revokes access, blocks logins, and releases assigned routes.

#### 10. System Connection Hub (`src/screens/SystemConnectionScreen.tsx`)
* **Role**: Central Cloud Run interoperability bridge.
* **Key Features**:
  - Production Base URL: `https://ais-dev-ui6fsepfskrowqsfycbac7-946013608969.asia-southeast1.run.app`.
  - Health check verification probe (`GET /api/health`).
  - Real-time latency measurement in milliseconds.
  - Direct route pull and batch push test tools.
  - JWT token inspection and cURL generator.

#### 11. Security & Architecture Defense (`src/screens/ArchitectureSecurityScreen.tsx`)
* **Role**: Telemetry and DDoS resilience testing.
* **Key Features**:
  - Sliding-window token-bucket rate limiter monitor.
  - Interactive bot flood simulation (up to 10,000 rapid requests).
  - Zero-latency mountain field offline resilience matrix.

#### 12. Audit Log & Compliance Ledger (`src/screens/AuditLogScreen.tsx`)
* **Role**: Forensic immutable history.
* **Key Features**:
  - Complete chronological record of logins, readings, route changes, batch syncs, and terminations.
  - Searchable by user, employee ID, and action type.

---

## 2. Daily Standard Operating Procedure (SOP)

```
[FIELD METER READER]
1. Open App ──► Sign in with Username + PIN
2. Hub ───────► Tap "Pull Latest Consumer Routes" (Office Wi-Fi)
3. Field ─────► Navigate Barangay Route (100% Offline)
                Scan Meter Dial ──► Verify Volume ──► Print Thermal Bill Slip
4. Sync ──────► Open "Batch Submission" ──► Tap "Upload Batch Readings"
```
