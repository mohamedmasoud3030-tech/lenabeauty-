-- Tauri v2.0 SQLite Schema
-- Offline-first desktop database for Windows EXE
-- Auto-applied on first app launch via Tauri migration system

-- Pragma settings for SQLite optimization
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA cache_size = -64000;

-- 1. Organization & Auth (Local)
CREATE TABLE IF NOT EXISTS centers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    currency TEXT DEFAULT 'OMR',
    tax_rate REAL DEFAULT 0.0,
    address TEXT,
    phone TEXT,
    cr TEXT,
    postal_code TEXT,
    logo_path TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    center_id TEXT NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'staff',
    is_active BOOLEAN DEFAULT 1,
    last_login TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 2. Core Business Entities
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    center_id TEXT NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT,
    phone TEXT,
    email TEXT,
    notes TEXT,
    total_spent REAL DEFAULT 0.0,
    loyalty_points INTEGER DEFAULT 0,
    last_visit TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    center_id TEXT NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    role TEXT,
    salary REAL DEFAULT 0.0,
    commission_percentage REAL DEFAULT 0.0,
    is_active BOOLEAN DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    center_id TEXT NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    duration_minutes INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    center_id TEXT NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    barcode TEXT,
    price REAL NOT NULL,
    cost REAL NOT NULL,
    stock_quantity INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    center_id TEXT NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
    service_id TEXT REFERENCES services(id) ON DELETE SET NULL,
    date_time TEXT NOT NULL,
    status TEXT DEFAULT 'SCHEDULED',
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    center_id TEXT NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
    serial_number TEXT,
    total_amount REAL NOT NULL,
    discount REAL DEFAULT 0.0,
    loyalty_points_used INTEGER DEFAULT 0,
    payment_method TEXT,
    date TEXT DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoice_items (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    service_id TEXT REFERENCES services(id),
    product_id TEXT REFERENCES products(id),
    price REAL NOT NULL,
    quantity REAL NOT NULL DEFAULT 1.0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    center_id TEXT NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    date TEXT DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 3. Sync & Backup Metadata
CREATE TABLE IF NOT EXISTS sync_log (
    id TEXT PRIMARY KEY,
    center_id TEXT NOT NULL REFERENCES centers(id),
    table_name TEXT NOT NULL,
    operation TEXT,
    record_id TEXT,
    last_synced TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS backup_history (
    id TEXT PRIMARY KEY,
    center_id TEXT NOT NULL REFERENCES centers(id),
    backup_path TEXT NOT NULL,
    backup_size INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    restored_at TEXT
);

-- 4. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customers_center ON customers(center_id);
CREATE INDEX IF NOT EXISTS idx_appointments_center_date ON appointments(center_id, date_time);
CREATE INDEX IF NOT EXISTS idx_invoices_center_date ON invoices(center_id, date);
CREATE INDEX IF NOT EXISTS idx_users_center_username ON users(center_id, username);

-- Schema version (for migrations)
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO schema_version (version) VALUES (1);
