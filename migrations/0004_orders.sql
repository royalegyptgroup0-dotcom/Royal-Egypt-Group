-- Orders table used by the coffee and transportation order intake flows.
-- Additive only; preserves all existing records and enforces the legacy status/type contract.
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_type TEXT NOT NULL CHECK(order_type IN ('coffee', 'transport')),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  details TEXT,
  preferred_date TEXT,
  preferred_time TEXT,
  language TEXT DEFAULT 'ar',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at);
