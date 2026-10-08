-- ====================================================================
-- TAGOLOAN WATER DISTRICT (WDT) DATABASE SCHEMA
-- Target Database: PostgreSQL / MySQL / Cloud SQL Relational Engine
-- System: Mobile Field Meter Reading, Real-Time Billing & Sync Engine
-- ====================================================================

-- 1. BARANGAYS & ADMINISTRATIVE JURISDICTIONS
CREATE TABLE IF NOT EXISTS barangays (
    id VARCHAR(36) PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    zone VARCHAR(50),
    total_accounts INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. WATER METER INVENTORY & SPECIFICATIONS
CREATE TABLE IF NOT EXISTS meters (
    id VARCHAR(36) PRIMARY KEY,
    meter_serial VARCHAR(50) NOT NULL UNIQUE,
    meter_number VARCHAR(50) UNIQUE,
    brand VARCHAR(50) DEFAULT 'ASAHI / ACTARIS',
    size_inch VARCHAR(20) DEFAULT '1/2"',
    type VARCHAR(50) DEFAULT 'Mechanical Rotary Piston',
    dial_digits INT DEFAULT 5,
    installation_date DATE,
    status VARCHAR(30) DEFAULT 'ACTIVE', -- ACTIVE, FAULTY, REPLACED, DISCONNECTED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. REGISTERED CONSUMER ACCOUNTS
CREATE TABLE IF NOT EXISTS consumers (
    id VARCHAR(36) PRIMARY KEY,
    account_number VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    address TEXT NOT NULL,
    barangay VARCHAR(100) NOT NULL,
    meter_id VARCHAR(36) REFERENCES meters(id),
    meter_serial VARCHAR(50) NOT NULL,
    meter_number VARCHAR(50),
    meter_size VARCHAR(20) DEFAULT '1/2"',
    category VARCHAR(50) DEFAULT 'Residential', -- Residential, Commercial, Industrial, Government
    status VARCHAR(30) DEFAULT 'Active', -- Active, Inactive, Disconnected
    previous_reading NUMERIC(10, 2) NOT NULL DEFAULT 0,
    previous_reading_date DATE NOT NULL,
    previous_consumption NUMERIC(10, 2) DEFAULT 0,
    average_consumption NUMERIC(10, 2) DEFAULT 0,
    rate_code VARCHAR(30) DEFAULT 'RES-01',
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    route_code VARCHAR(50) NOT NULL,
    sequence_no INT NOT NULL,
    contact_number VARCHAR(30),
    last_sync_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. FIELD METER READERS & MOBILE OPERATORS
CREATE TABLE IF NOT EXISTS meter_readers (
    id VARCHAR(36) PRIMARY KEY,
    employee_id VARCHAR(50) NOT NULL UNIQUE,
    username VARCHAR(50) NOT NULL UNIQUE,
    pin_hash VARCHAR(255) NOT NULL,
    name VARCHAR(150) NOT NULL,
    role VARCHAR(50) DEFAULT 'Meter Reader',
    contact_number VARCHAR(30),
    email VARCHAR(100),
    status VARCHAR(30) DEFAULT 'active', -- pending, active, rejected, deactivated
    employment_status VARCHAR(30) DEFAULT 'active',
    device_info TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

-- 5. READER ROUTE ASSIGNMENTS
CREATE TABLE IF NOT EXISTS reader_routes (
    id VARCHAR(36) PRIMARY KEY,
    reader_id VARCHAR(36) REFERENCES meter_readers(id) ON DELETE CASCADE,
    route_code VARCHAR(50) NOT NULL,
    barangay VARCHAR(100) NOT NULL,
    assignment_date DATE DEFAULT CURRENT_DATE
);

-- 6. METER READINGS & FIELD TRANSACTION LOG
CREATE TABLE IF NOT EXISTS meter_readings (
    id VARCHAR(36) PRIMARY KEY,
    account_number VARCHAR(30) NOT NULL REFERENCES consumers(account_number),
    consumer_name VARCHAR(150) NOT NULL,
    barangay VARCHAR(100) NOT NULL,
    meter_serial VARCHAR(50) NOT NULL,
    reader_id VARCHAR(36) REFERENCES meter_readers(id),
    reader_name VARCHAR(150) NOT NULL,
    previous_reading NUMERIC(10, 2) NOT NULL,
    current_reading NUMERIC(10, 2) NOT NULL,
    consumption NUMERIC(10, 2) NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL,
    billing_period VARCHAR(30) NOT NULL, -- e.g., 'August 2026'
    reading_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    due_date DATE NOT NULL,
    reading_method VARCHAR(30) DEFAULT 'MANUAL', -- MANUAL, OCR_CAMERA, BARCODE_LOOKUP
    meter_condition VARCHAR(50) DEFAULT 'NORMAL', -- NORMAL, DEFECTIVE, LEAKING, BLURRED, GLASS_CRACKED
    anomaly_detected BOOLEAN DEFAULT FALSE,
    anomaly_type VARCHAR(100), -- HIGH_CONSUMPTION, ZERO_CONSUMPTION, REVERSE_ROTATION
    photo_evidence_url TEXT,
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    status VARCHAR(30) DEFAULT 'PENDING_APPROVAL', -- PENDING_APPROVAL, APPROVED, REJECTED
    is_offline_sync BOOLEAN DEFAULT FALSE,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. TIERED WATER RATES (LWUA APPROVED SCHEDULE)
CREATE TABLE IF NOT EXISTS billing_rates (
    id VARCHAR(36) PRIMARY KEY,
    rate_code VARCHAR(30) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL, -- Residential, Commercial, Commercial-B, Industrial
    meter_size VARCHAR(20) DEFAULT '1/2"',
    min_charge NUMERIC(10, 2) NOT NULL, -- Minimum charge for first 10 cu.m
    min_volume INT DEFAULT 10,
    tier1_rate NUMERIC(10, 2) NOT NULL, -- Rate for 11-20 cu.m
    tier2_rate NUMERIC(10, 2) NOT NULL, -- Rate for 21-30 cu.m
    tier3_rate NUMERIC(10, 2) NOT NULL, -- Rate for 31+ cu.m
    effective_date DATE DEFAULT '2026-01-01',
    is_active BOOLEAN DEFAULT TRUE
);

-- 8. AUDIT TRAILS & TAMPER-EVIDENT EVENT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    performed_by VARCHAR(150) NOT NULL,
    details TEXT,
    severity VARCHAR(20) DEFAULT 'INFO', -- INFO, WARNING, ERROR, CRITICAL
    ip_address VARCHAR(50),
    device_info TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES FOR MAXIMUM QUERY EFFICIENCY
CREATE INDEX IF NOT EXISTS idx_consumers_barangay ON consumers(barangay);
CREATE INDEX IF NOT EXISTS idx_consumers_route ON consumers(route_code);
CREATE INDEX IF NOT EXISTS idx_consumers_meter_serial ON consumers(meter_serial);
CREATE INDEX IF NOT EXISTS idx_readings_account ON meter_readings(account_number);
CREATE INDEX IF NOT EXISTS idx_readings_date ON meter_readings(reading_date);
CREATE INDEX IF NOT EXISTS idx_readings_status ON meter_readings(status);
