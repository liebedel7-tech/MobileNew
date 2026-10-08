# Frontend Layer - Tagoloan Water District (WDT)

The **Frontend Layer** is an offline-first Progressive Web App (PWA) built with **React, TypeScript, Tailwind CSS, and Vite**, purpose-engineered for field meter readers operating Android and mobile handheld devices across Tagoloan, Misamis Oriental.

## Directory Structure
```
frontend/
├── public/               # Manifest, district icons, static splash graphics
├── src/
│   ├── components/       # Reusable UI widgets (Header, BottomNav, AnomalyBadges, Cards)
│   ├── screens/          # App views (Landing, Login, Dashboard, Consumers, ReadingEntry, ScanMeter, History, BatchSync)
│   ├── services/         # API client, offline IndexedDB storage, Bluetooth thermal printer, GPS
│   ├── types/            # TypeScript interfaces for consumers, readings, accounts, and telemetry
│   ├── data/             # Local database cache and fallback fixtures
│   ├── App.tsx           # Primary mobile shell, route state manager, network banner
│   ├── main.tsx          # React 19 application mount point
│   └── index.css         # Tailwind utility styling
├── package.json          # Frontend build configuration & client dependencies
└── README.md             # Frontend layer guide
```

## Key Capabilities
1. **Offline Queueing**: Automatically caches readings locally in browser storage when cell signal drops in rural barangays.
2. **Real-Time WebSocket Sync**: Connects to the backend server with exponential backoff and instant data pushes.
3. **Dual Dial Input**: Supports camera dial image capture with OCR assistance or rapid mechanical dial numeric entry.
4. **Bluetooth Thermal Receipt Printing**: Generates 58mm LWUA-compliant on-site statement of accounts for consumers.
