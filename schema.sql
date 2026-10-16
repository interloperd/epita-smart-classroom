-- EPITA Smart Classroom — schéma Cloudflare D1
-- À exécuter une fois dans la console D1 (Storage & databases → D1 → smart-classroom-db → Console)

CREATE TABLE IF NOT EXISTS audits (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  room TEXT,
  source TEXT,
  model TEXT,
  threshold REAL,
  total INTEGER,
  gaps INTEGER,
  verifiable INTEGER,
  global_status TEXT,
  quality TEXT,
  duration_s REAL,
  inference_ms REAL,
  detection_rate REAL,
  counts_json TEXT,
  rows_json TEXT,
  image_key TEXT
);

CREATE TABLE IF NOT EXISTS anomalies (
  id TEXT PRIMARY KEY,
  audit_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  type TEXT,
  category TEXT,
  severity TEXT,
  title TEXT,
  action TEXT,
  status TEXT NOT NULL DEFAULT 'Ouverte',
  comment TEXT DEFAULT ''
);

-- Repli si R2 n'est pas activé : images stockées en base64 dans D1
CREATE TABLE IF NOT EXISTS images (
  audit_id TEXT PRIMARY KEY,
  mime TEXT NOT NULL,
  data TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_anomalies_audit ON anomalies(audit_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_status ON anomalies(status);
CREATE INDEX IF NOT EXISTS idx_audits_created ON audits(created_at);
