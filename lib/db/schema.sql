-- Skema database Network Monitor (Turso / SQLite).
-- DDL ini juga dijalankan otomatis oleh initDb() di lib/db/client.ts.

CREATE TABLE IF NOT EXISTS speed_tests (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  download   REAL NOT NULL,               -- Mbps
  upload     REAL NOT NULL,               -- Mbps
  ping       REAL,                        -- ms
  jitter     REAL,                        -- ms
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS devices (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ip        TEXT NOT NULL UNIQUE,
  hostname  TEXT,
  mac       TEXT,
  vendor    TEXT,                            -- hasil OUI lookup
  status    TEXT NOT NULL DEFAULT 'offline', -- online | offline
  last_seen TEXT
);

CREATE TABLE IF NOT EXISTS latency_samples (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  latency_ms  REAL,
  packet_loss REAL,                        -- persen
  jitter_ms   REAL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS outages (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at       TEXT,
  ended_at         TEXT,
  duration_seconds INTEGER
);
