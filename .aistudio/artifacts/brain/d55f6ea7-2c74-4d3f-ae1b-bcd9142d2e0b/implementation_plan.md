# Central Admin Approvals & Meter Readers Synchronization Plan

## Overview
Comprehensive synchronization between the Central Admin Web Portal modules and the Mobile Meter Reader terminal for:
1. **Reading Approvals Module**: Direct routing of mobile field readings into the supervisor approval ledger (`approvalStatus: 'pending_approval'`), with one-click approval (issuing bills and advancing the baseline index) or flagging for re-inspection.
2. **Meter Readers Module**: Automatic enrollment of mobile-registered meter readers into the Admin roster, with live route occupancy and real-time termination/lockout enforcement.
3. **Termination Reflection**: When an Admin terminates a meter reader account, mobile terminals immediately intercept the event via WebSocket, wipe session tokens, and lock the user out with a full-screen termination notice.

---

## Architectural Implementation

### 1. Readings Submission & Approvals Pipeline
- **Submission (`POST /api/readings/submit` & `POST /api/readings/batch`)**:
  - Readings submitted from the mobile terminal (via camera OCR or manual entry) are saved with `approvalStatus: 'pending_approval'`.
  - Dispatches `READING_SUBMITTED_FOR_APPROVAL` via WebSocket to Central Admin.
- **Approvals Ledger (`GET /api/readings` & `GET /api/readings/pending`)**:
  - Lists all submitted readings with previous baseline, present reading, consumption volume (cu.m.), bill computation, GPS coordinates, photo attachment, and reader ID.
- **Admin Approval Execution (`POST /api/readings/:id/approve`)**:
  - Marks reading status as `approved` and `SYNCED`.
  - Automatically advances the consumer's baseline reading: `consumer.previousReading = reading.currentReading`, updates `previousConsumption`, and sets `isReadThisMonth: true`.
  - Dispatches `READING_APPROVED_BILL_ISSUED` and `CONSUMER_UPDATED` WebSocket events.
- **Admin Rejection / Flagging (`POST /api/readings/:id/reject`)**:
  - Marks reading as `rejected` with rejection reason (e.g. "Unclear dial photo", "Index mismatch").
  - Dispatches `READING_REJECTED_REINSPECT` to notify the reader terminal.

### 2. Meter Readers Roster & Mobile Auto-Registration
- **Mobile Registration (`POST /api/readers/register`)**:
  - When a meter reader signs up or registers in the mobile app, their profile is automatically synced to the Central Admin Meter Readers module (`REGISTERED_READERS`).
  - Verifies location/route exclusivity (prevents multiple readers taking the same route unless explicitly authorized).
  - Broadcasts `READER_REGISTERED_ACTIVE` to Central Admin in real time.
- **Roster Management (`GET /api/readers`)**:
  - Displays all registered readers, employee IDs, contact details, assigned routes, and operational statuses (`ACTIVE` vs `TERMINATED`).

### 3. Immediate Account Termination & Mobile Lockout
- **Admin Termination Endpoint (`POST /api/readers/:id/terminate`)**:
  - Sets reader status to `'terminated'` with reason, timestamp, and administrator audit entry.
  - Broadcasts `READER_ACCOUNT_TERMINATED`, `READER_TERMINATED`, and `staff:terminated` WebSocket packets.
- **Mobile Real-Time Session Termination (`src/App.tsx`)**:
  - If the terminated reader is currently active in the field:
    1. Intercepts the WebSocket termination signal.
    2. Immediately wipes authentication credentials from `localStorage`.
    3. Clears `currentUser` state.
    4. Triggers `TerminatedReaderLockoutModal`: a full-screen, un-dismissable lockout displaying the administrator's reason and blocking all route and reading features.
- **Login Defense (`src/screens/LoginScreen.tsx` & `POST /api/auth/login`)**:
  - If a terminated reader attempts to log in, the backend and client reject the attempt with HTTP 403 Forbidden: *"This meter reader account has been terminated or revoked by administration."*

### 4. Admin Modules Hub Console (`src/components/AdminMeterStatusModal.tsx`)
Accessible via the header button ("Admin Modules"), offering complete supervisory control across 5 tabs:
1. **Reading Approvals**: Pending approval queue with dial progression chains and one-click "Approve & Issue Bill" and "Flag / Reject".
2. **Meter Readers**: Live meter reader roster showing mobile enrollments, route coverage, and "Terminate Reader" / "Reactivate Account" controls.
3. **Water Meters**: Hardware status toggles (Active, Inactive, Damaged, Maintenance).
4. **Consumers**: Consumer connection states (Active, Inactive, Disconnected).
5. **Issue IDs Hub**: ID issuance for pending applicants before mobile route synchronization.

---

## Verification Summary
- Verified `compile_applet` and `lint_applet` (`tsc --noEmit`) with 0 errors.
- Verified reading submission, approval, and consumer baseline advance via REST endpoints.
- Verified reader auto-registration, route conflict checks, and admin termination lockout.
