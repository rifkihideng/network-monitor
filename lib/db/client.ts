import { createClient } from "@libsql/client";
import { mkdirSync } from "node:fs";
import path from "node:path";

const url = process.env.TURSO_DATABASE_URL ?? "file:./data/local.db";

// Pastikan folder untuk SQLite lokal ada sebelum client menulis file.
if (url.startsWith("file:")) {
  const filePath = url.slice("file:".length);
  mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
}

export const db = createClient(
  url.startsWith("file:")
    ? { url }
    : { url, authToken: process.env.TURSO_AUTH_TOKEN },
);

// DDL dibuat idempoten (CREATE TABLE IF NOT EXISTS) agar aman dipanggil berulang.
const DDL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS speed_tests (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    download   REAL NOT NULL,
    upload     REAL NOT NULL,
    ping       REAL,
    jitter     REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS devices (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    ip        TEXT NOT NULL UNIQUE,
    hostname  TEXT,
    mac       TEXT,
    vendor    TEXT,
    status    TEXT NOT NULL DEFAULT 'offline',
    last_seen TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS latency_samples (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    latency_ms  REAL,
    packet_loss REAL,
    jitter_ms   REAL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS outages (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at       TEXT,
    ended_at         TEXT,
    duration_seconds INTEGER
  )`,
];

export async function initDb(): Promise<void> {
  for (const sql of DDL_STATEMENTS) {
    await db.execute(sql);
  }
  // Migrasi ringan untuk database yang sudah ada sebelum kolom vendor ditambahkan.
  try {
    await db.execute("ALTER TABLE devices ADD COLUMN vendor TEXT");
  } catch {
    // Kolom sudah ada.
  }
}
