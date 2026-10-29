# Reading Tracking & Mobile Terminal Continuity Plan

## Objective
Ensure that every consumer across all meter readings maintains continuous and uninterrupted tracking of **Previous Reading (Baseline Index)**, **Present Reading (Current Meter Index)**, and **Net Consumption (cu.m.)**, while strictly complying with the mobile operational constraints:
- **No Bill Printing / Bill Issuance on Mobile**: Field readers log meter dials and transmit data; billing calculation and tariff breakdown remain strictly on the Central Admin portal.
- **No Barcode Scanning**: Optical focus is exclusively on meter Tag # and 5-dial odometer numbers via camera OCR.
- **Precision Visual Targeting**: High-contrast camera HUD with directional pointers (`▼ 10k ▼ 1k ▼ 100 ▼ 10 ▼ 1`), 5 odometer roller boxes, Tag reticle, and zoom controls.
- **Unbroken Reading Continuity**: Reading data is synchronized across IndexedDB stores, cached in-memory on the server, and tracked across Consumers, Consumer Details, Reading Entry, and History screens.

---

## Changes Implemented

### 1. Database & Persistence Layer Continuity (`src/services/databaseHelper.ts`)
- **Dual-Store Enrichment**: `getAllConsumers()`, `getConsumerById()`, `getConsumerByAccountNumber()`, and `getConsumerByMeterSerial()` now query both `consumers` and `readings` stores.
- **Timestamp Ordering**: Readings are sorted newest-first and joined by `consumerId` OR `accountNumber`, attaching `currentMonthReading` and setting `isReadThisMonth: true`.
- **Atomic Two-Way Updates**: `saveReading()` writes to the `readings` store and simultaneously updates the `consumers` store by ID and account number index.

### 2. Background Sync Continuity (`src/services/syncService.ts`)
- Enriched consumer sync payload merges existing local readings by `consumerId` and `accountNumber`, ensuring background sync polls never overwrite or detach present readings.

### 3. Server-Side Cache Consistency (`server.ts`)
- `/api/readings/submit` and `/api/readings/batch` update in-memory `INITIAL_CONSUMERS` records so server pulls retain `currentMonthReading` and `isReadThisMonth`.

### 4. Application State Synchronization (`src/App.tsx`)
- On reading save, `selectedConsumer` is immediately mutated with `isReadThisMonth: true` and the new `currentMonthReading`, keeping `ConsumerDetailsScreen` instantly synchronized without re-navigation lag.

### 5. UI Reading Continuity Across All Screens
- **Consumers Screen (`src/screens/ConsumersScreen.tsx`)**:
  - `PREVIOUS READING`: `{consumer.previousReading} cu.m.`
  - `PRESENT READING`: `{consumer.currentMonthReading.currentReading} cu.m.` (bold sky-300) or `Pending`.
  - `CONSUMPTION`: `+{consumer.currentMonthReading.consumption} cu.m.` (bold emerald-400) or historical previous consumption.
- **Consumer Details Screen (`src/screens/ConsumerDetailsScreen.tsx`)**:
  - Prominent reading continuity card displaying:
    - `PREVIOUS READING (BASELINE INDEX)`: `{consumer.previousReading} cu.m.`
    - `PRESENT READING (CURRENT METER INDEX)`: `{consumer.currentMonthReading.currentReading} cu.m.`
    - `TOTAL CONSUMPTION`: `+{consumer.currentMonthReading.consumption} cu.m.`
  - Historical reading progression chain showing `Previous Index ➔ Present Index = Net Volume` with Admin approval status badges (`Pending Admin Approval`, `Approved & Billed`, `Flagged / Rejected`).
- **Reading Entry Screen (`src/screens/ReadingEntryScreen.tsx`)**:
  - Prefills present reading from `consumer.currentMonthReading.currentReading` if already logged, preventing blanking on revisits.
  - Live 3-step reading progression box with `cu.m.` units.
  - Direct "Send to Admin Dashboard" button dispatching readings via WebSocket and REST.
- **History Screen (`src/screens/HistoryScreen.tsx`)**:
  - Each archive card displays `PREVIOUS: X cu.m. • PRESENT: Y cu.m. • CONSUMPTION: +Z cu.m.`.

### 6. Strict Mobile Boundary & Camera Targeting
- Deleted `ThermalReceiptModal.tsx` and removed all mobile printer and Bluetooth permissions.
- Removed barcode scanner components from mobile workflows.
- Retained precision OCR camera HUD (`src/components/ScanOverlay.tsx`) with digit pointers, odometer roller boxes, Tag # reticle, and zoom presets (`1x`, `1.5x`, `2x`, `3x`).

---

## Verification
- `tsc --noEmit` passed with 0 errors.
- `npm run build` compiled successfully.
- Dev server healthy on port 3000.
