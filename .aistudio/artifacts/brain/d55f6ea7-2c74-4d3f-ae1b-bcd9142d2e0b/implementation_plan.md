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

## 3. Test Verification
- **Automated Test**: `TC-MOB-04: Admin Single Action: Termination & Immediate Mobile Lockout with Auto-Freed Routes`
- **Result**: PASS (Termination HTTP 200, Post-Termination Login HTTP 403, Routes Freed: true).
