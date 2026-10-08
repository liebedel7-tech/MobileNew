# Tagoloan Water District (WDT) - Mobile Meter Reading & Billing System

A separated three-tier full-stack application engineered for real-time and offline-first water meter reading, LWUA-compliant volumetric tiered billing computation, optical character recognition (OCR) of mechanical meter dials, Bluetooth thermal printing, and central server synchronization.

---

## Full-Stack Project Structure

```
project/
├── frontend/
│   ├── public/                # Static assets, WebAPK manifest, icons
│   ├── src/
│   │   ├── assets/            # Water District seal, emblems, logos
│   │   ├── components/        # Reusable UI components (header, bottom nav, badges, modals)
│   │   ├── context/           # App-level contexts
│   │   ├── hooks/             # Custom React hooks (geolocation, offline status)
│   │   ├── screens/           # Views (Landing, Login, Dashboard, Consumers, Reading, History, Sync)
│   │   ├── services/          # API client, IndexedDB offline cache, Bluetooth printer, OCR
│   │   ├── utils/             # Formatters, rate helpers, currency utilities
│   │   ├── types/             # TypeScript interfaces for consumers, readings, readers
│   │   ├── App.tsx            # Root mobile shell & screen router
│   │   ├── main.tsx           # React DOM 19 entry point
│   │   └── index.css          # Tailwind CSS styles
│   ├── package.json           # Frontend client configuration
│   └── README.md              # Frontend architectural documentation
│
├── backend/
│   ├── config/                # Environment, port, CORS, and WebSocket settings
│   ├── controllers/           # API request handlers (auth, reading, consumer, stats, OCR)
│   ├── models/                # Data structures and entities (Consumer, Reading, Reader, Billing)
│   ├── routes/                # Express API endpoints
│   ├── middlewares/           # Authentication, input validation, error handling
│   ├── services/              # Business logic (LWUA billing tariffs, sync queue, Gemini OCR)
│   ├── utils/                 # Response formatters, logger, mathematical helpers
│   ├── database/              # Symlinked/integrated database abstraction
│   ├── tests/                 # Unit and integration test suites
│   ├── server.ts              # Standalone backend server entry point
│   └── package.json           # Backend dependencies and scripts
│
├── database/
│   ├── schemas/               # Relational SQL schema definitions (PostgreSQL/Cloud SQL)
│   ├── seeds/                 # Tagoloan Water District seed records (consumers, meters, readers)
│   ├── connection.ts          # Database connection pool manager and health checks
│   ├── db.ts                  # Central query store & repository methods
│   └── README.md              # Entity-relationship diagrams and schema documentation
│
├── PROJECT_STRUCTURE.md       # Comprehensive full-stack justification document
├── package.json               # Root workspace orchestrator
├── server.ts                  # Unified dev & production server (Express + Vite middlewares)
└── vite.config.ts             # Vite build and asset pipeline configuration
```

---

## Architectural Justification & Layer Responsibilities

| Layer | Responsibility | Tagoloan Water District Implementation |
| :--- | :--- | :--- |
| **`frontend/`** | User interface & interaction | Mobile PWA for field meter readers with offline data buffering, camera OCR dial capture, and thermal bill printing. |
| **`backend/`** | API, business logic, validation & sync | Authentication, LWUA tiered rate calculations, anomaly detection algorithms, WebSocket broadcast, and bulk sync. |
| **`database/`** | Persistent storage & relational data | Structured consumer accounts, meter specifications, historical consumption logs, route sequences, and audit trails. |

---

## Why This Structure Is Better for the Project

1. **Separation of Responsibilities**: Presentation (React/Vite), computation (Node.js/Express), and storage (PostgreSQL/SQL Schema) are decoupled, avoiding monolithic entanglement.
2. **Offline-First Resilience**: Field readers working in areas with intermittent connectivity continue operating via local queues without disrupting server or database integrity.
3. **Security & Centralized Business Logic**: Billing rules and reading approvals are validated on the backend to prevent client-side tampering.
4. **Multi-Interface Scalability**: The same backend API and database can simultaneously serve the mobile reader app, web administrative portals, and future consumer self-service kiosks.
