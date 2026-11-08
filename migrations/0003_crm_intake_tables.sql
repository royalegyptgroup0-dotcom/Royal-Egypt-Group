-- CRM intake tables used by the public contact form and owner inbox.
-- Additive only: does not modify existing listings or rate-limit data.
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT,
  phone TEXT,
  country TEXT,
  language TEXT DEFAULT 'ar',
  type TEXT DEFAULT 'lead',
  budget_min REAL,
  budget_max REAL,
  interests TEXT,
  status TEXT DEFAULT 'new',
  assigned_agent TEXT,
  notes TEXT,
  source TEXT,
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_customers_created ON customers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);

CREATE TABLE IF NOT EXISTS opportunities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  source TEXT,
  country TEXT,
  url TEXT,
  details TEXT,
  estimated_value TEXT,
  status TEXT DEFAULT 'discovered',
  assigned_agent TEXT,
  created_at DATETIME DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_opportunities_created ON opportunities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);
