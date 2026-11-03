# Tagoloan Water District • System & Mobile Structural Connection Audit

## 1. Verified Live Nodes
- **Central Admin & Billing Server**: `https://twd-427m.onrender.com` (Uptime: 10,000s+, 62 consumers, active WebSocket broker).
- **Field Mobile Terminal App**: `https://mobile-li9q.onrender.com` (Uptime: 15,700s+, offline IndexedDB cache, 5-digit odometer keypad + camera OCR).

---

## 2. Structural Communication Architecture

```
┌──────────────────────────────────────────────────────────┐
│          FIELD MOBILE TERMINAL (mobile-li9q)            │
│  - React 19 + Tailwind CSS + PWA WebAPK                   │
│  - 5-Digit Whole-Number Odometer Entry (00000-99999)     │
│  - Camera OCR + GPS Geotagging                           │
│  - Offline SQLite / IndexedDB Queue                      │
└───────────────▲──────────────────────────┬───────────────┘
                │                          │
       WebSocket Broadcast         REST Sync & Batches
       (wss://twd-427m/ws)         (https://twd-427m/api)
                │                          │
                │                          ▼
┌───────────────┴──────────────────────────────────────────┐
│        CENTRAL BILLING & ADMIN SERVER (twd-427m)         │
│  - GET  /api/health            (System Health Probe)     │
│  - GET  /api/consumers         (Consumer Masterlist)     │
│  - POST /api/readings/submit   (Single Admin Ingestion)  │
│  - POST /api/readings/batch    (Batch Upload Ingestion)  │
│  - GET  /api/readers           (Registered Readers)      │
│  - POST /api/readers/register  (Mobile Auto-Enrolment)   │
│  - POST /api/readers/:id/term  (Admin Revocation Lock)   │
│  - WSS  /ws                    (Real-Time Event Broker)  │
└──────────────────────────────────────────────────────────┘
```

---

## 3. End-to-End Test Verification Results
- **TC-MOB-01**: Gateway Health Probe & District Identification (PASS)
- **TC-MOB-02**: Direct Auto-Active Registration (Zero Admin Delay) (PASS)
- **TC-MOB-03**: Mobile Reader Login & Session Authorization (PASS)
- **TC-MOB-04**: Admin Single Action: Termination & Immediate Mobile Lockout (PASS)
- **TC-MOB-05**: Admin ID Issuance Validation Gate (No Pending Applicants) (PASS)
- **TC-MOB-06**: Live Field Reading Transmission with GPS & Photo (PASS)
- **TC-MOB-07**: Offline Queue Batch Ingestion (Field Dead-Spot Recovery) (PASS)
- **TC-MOB-08**: Strict No-Print & No-Bill-Distribution Enforcement (PASS)
- **Total Test Duration**: 139ms (8/8 Passed)
