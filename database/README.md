# Database Layer - Tagoloan Water District (WDT)

The **Database Layer** manages all data persistence, relational schema models, connection pooling, seed records, and transactional updates for the Tagoloan Water District Mobile and Field Billing System.

## Directory Structure
```
database/
├── schemas/
│   └── schema.sql        # Standard SQL schema definitions (PostgreSQL/MySQL/Cloud SQL)
├── seeds/
│   └── seedData.ts       # Default initial consumers, meters, readers, and rate tables
├── connection.ts         # Database connection pool manager & health checker
├── db.ts                 # Unified repository & query store
└── README.md             # Database documentation & entity relationship reference
```

## Relational Entities
1. **`consumers`**: Consumer account records, addresses, meter serial numbers, historical reading baselines, and GPS coordinates.
2. **`meters`**: Physical water meter specifications, size (`1/2"`), serial number, brand, and mechanical dial digit count (5 digits).
3. **`meter_readings`**: Field transaction log submitted by mobile meter readers with before/after indices, computed billing, anomaly flags, and GPS geotags.
4. **`meter_readers`**: Field workforce personnel accounts with employee IDs, PIN authentication, and assigned barangay routes.
5. **`billing_rates`**: LWUA-approved tiered billing schedules for Residential, Commercial, and Industrial accounts.
6. **`audit_logs`**: Tamper-evident activity logs capturing logins, reading submissions, offline sync runs, and administrative approvals.
