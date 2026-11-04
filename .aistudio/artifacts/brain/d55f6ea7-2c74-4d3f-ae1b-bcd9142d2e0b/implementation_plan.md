# Tagoloan Water District • Deactivated Account Area Route Auto-Availability

## 1. Feature Specification
When a meter reader account is detected as deactivated, terminated, or revoked:
1. The area routes previously assigned to that reader are **automatically and instantly released**.
2. Those locations immediately change from **Occupied** (`isOccupied: true`) to **Available** (`isOccupied: false`) across the mobile registration screen, route selector, and central occupancy API (`/api/locations/availability`).
3. New meter readers or existing readers re-assigning coverage can immediately select the newly freed locations without administrative delay.

---

## 2. Implementation Across Modules
- **`src/constants/routes.ts`**:
  - `isReaderAccountDeactivated(r)` checks `status`, `employmentStatus`, `isTerminated`, and `isDeactivated` flags.
  - `calculateLocationOccupancies` filters out any deactivated readers so their locations are reported as unoccupied.
- **`src/services/databaseHelper.ts`**:
  - `updateLocalReaderStatus` automatically clears `assignedRoutes: []` and archives them to `previousAssignedRoutes` when status is set to `terminated` or `rejected`.
- **`src/screens/LoginScreen.tsx`**:
  - Merges server and local readers with deactivation priority.
  - Listens to real-time `READER_ACCOUNT_TERMINATED`, `READER_TERMINATED`, and `READER_STATUS_CHANGED` WebSocket events to reload occupancy immediately.
  - Displays `"✓ Routes of deactivated accounts are automatically released & available"` in the registration route selector.
- **`src/screens/MeterReadersScreen.tsx`**:
  - When Admin terminates an account, clears `assignedRoutes` to `[]` and informs the admin which routes were automatically released.
- **`server.ts`**:
  - Releases `assignedRoutes: []` on `POST /api/readers/:id/terminate` and broadcasts `ROUTE_FREED_FOR_ASSIGNMENT`.

---

## 3. Reading Approval Automatic Status Change & Baseline Persistence
When the Administrator approves or accepts meter readings:
1. **Status Transition**: The reading status immediately transitions from `Pending Admin Approval` / `PENDING_APPROVAL` to `APPROVED` / `Approved by Admin` (status: `'APPROVED'`, approvalStatus: `'approved'`), eliminating any lingering pending states.
2. **Automatic Data Saving & Baseline Advancement**:
   - The consumer's previous reading baseline is automatically updated to the approved reading: `previousReading = currentReading`.
   - `previousConsumption` is updated to the approved reading's `consumption`.
   - `previousReadingDate` is updated to the approved reading's date.
   - `isReadThisMonth` is set to `true`, and `currentMonthReading` is linked with the approved reading.
   - The updated consumer and reading records are permanently saved to both local IndexedDB and server data stores.
3. **Real-time Mobile Synchronization**:
   - `server.ts` broadcasts `READING_APPROVED` and `READING_APPROVED_BILL_ISSUED` with the approved reading and updated consumer baseline over WebSocket.
   - Handheld clients capture the event, invoke `DatabaseHelper.updateReadingApprovalStatus`, advance local state, dispatch a top alert banner, and update the UI in real time.
   - `ReadingEntryScreen`: Dynamically transitions post-save card and transmission badge from amber "Pending Admin Approval" to emerald "Approved by Admin (Saved)".
   - `ConsumersScreen` & `ConsumerDetailsScreen`: Reflect `APPROVED` badge and advanced odometer baseline.
   - `HistoryScreen`: Filters and badges strictly classify approved readings under `Approved & Billed`.

---

## 4. Central System Consumer Sync & Account/Tag Number Validation Gate
1. **Real System Consumer Integration**:
   - Replaced legacy artificial mock data with the actual 62 real consumers from the Tagoloan Water District system archive (`.data/portal_sync_store.json` and `mockDb.ts`), covering all 10 barangays: Poblacion, Baluarte, Natumolan, Sta. Ana, Sta. Cruz, Mohon, Gracia, Casinglot, Sugbongcogon, and Rosario.
   - Synchronized consumers across `src/data/seedData.ts`, `src/services/databaseHelper.ts`, and `server.ts`.
2. **Account and Tag Number Validation Gate**:
   - Every consumer is strictly verified to ensure both a valid **Account Number** (non-empty, not pending, e.g. `BRG-01-3951`, `011-102-056`, `BRG-07-6022`) and a valid **Meter Tag Number / Serial Number** (e.g. `MT-39837`, `150307143`, `MT-76113`) are officially issued.
   - Pending applicants without an issued Account or Tag Number (e.g. `FULL SYNC CONSUMER`, `TEST`, etc. with empty account/meter numbers) are isolated and withheld from mobile field reader sync until an administrator approves and issues credentials.
3. **Respective Assigned Area Route Automatic Sync**:
   - Consumers are automatically mapped to meter readers strictly based on their assigned routes / barangays (e.g. `RDR-001` with Poblacion & Baluarte gets 32 assigned consumers; `RDR-004` with Gracia & Rosario gets 9 assigned consumers).
   - `isConsumerInAssignedAreas` implements canonical barangay matching (`poblacion`, `natumolan`, `baluarte`, `staana`, `stacruz`, `mohon`, `gracia`, `casinglot`, `sugbongcogon`, `rosario`) without false-positive substring overlap.
   - `DatabaseHelper.saveConsumers` normalizes incoming fields (`id`, `accountNumber`, `meterSerial`, `meterNumber`, `routeCode`, `category`) so IndexedDB keyPath `'id'` never fails.
   - Added dedicated `/api/readers/:id/consumers` and `/api/consumers/assigned/:readerId` endpoints on `server.ts`.

---

## 5. Mobile App Boundaries & Unified Reading Status Resolution
1. **Removal of Admin Modules from Mobile Terminal**:
   - The Tagoloan Water District Mobile Terminal is exclusively designated for Field Meter Readers. Admin operations (such as staff termination, physical meter inventory changes, and consumer applicant ID issuance) belong strictly to the Central Admin Desktop Web Portal.
   - Removed the `Admin Modules` button from `src/components/WDTHeader.tsx` and removed the `AdminMeterStatusModal` from `src/App.tsx`.
2. **Unified Mutually-Exclusive Reading Status**:
   - Fixed the status calculation bug where uploaded readings (`status === 'SYNCED'`) were erroneously counted as approved while remaining pending approval, causing dual and inconsistent badges.
   - Defined strict mutually exclusive status helpers across `HistoryScreen.tsx`, `DashboardScreen.tsx`, and `ConsumerDetailsScreen.tsx`:
     - **Approved & Billed**: `approvalStatus === 'approved' || status === 'APPROVED'`
     - **Flagged / Rejected**: `approvalStatus === 'rejected' || status === 'REJECTED'`
     - **Pending Admin Approval**: `!isApproved && !isRejected`
   - Zero overlap: a reading can never simultaneously display both "Pending Admin Approval" and "Approved & Billed".
3. **Approval Reconciliation & Deduplication**:
   - In `DatabaseHelper.getAllReadings()`, readings are consolidated per consumer account. When an approved reading is present for an account, any stale duplicate pending record for that same account is resolved and omitted from the log.
   - In `DatabaseHelper.updateReadingApprovalStatus()`, matching prioritizes the consumer's `accountNumber` so that live approvals received via WebSocket or sync immediately update all local readings for that account.

---

## 6. Test Verification
- **Automated Test Suite**: 9/9 tests passed (100% pass rate) via `tests/runMobileTests.ts`.
  - `TC-MOB-01`: Gateway Health Probe & District Identification (PASS)
  - `TC-MOB-02`: Direct Auto-Active Registration (Zero Admin Delay) (PASS)
  - `TC-MOB-03`: Mobile Reader Login & Session Authorization (PASS)
  - `TC-MOB-04`: Admin Single Action: Termination & Auto-Freed Routes (PASS)
  - `TC-MOB-05`: Admin ID Issuance Validation Gate (62 Validated System Consumers) (PASS)
  - `TC-MOB-06`: Live Field Reading Transmission with GPS & Photo (PASS)
  - `TC-MOB-07`: Offline Queue Batch Ingestion (Field Dead-Spot Recovery) (PASS)
  - `TC-MOB-08`: Strict No-Print & No-Bill-Distribution Enforcement (PASS)
  - `TC-MOB-09`: Automatic Status Change to APPROVED & Baseline Data Persistence (PASS)
