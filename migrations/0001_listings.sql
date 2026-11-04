CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  title TEXT NOT NULL,
  property_type TEXT NOT NULL,
  location TEXT NOT NULL,
  area_sqm REAL,
  price TEXT,
  purpose TEXT,
  description TEXT NOT NULL,
  images TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL,
  reviewed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_listings_status_created ON listings(status, created_at);