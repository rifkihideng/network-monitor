import {
  createClient,
  type Client,
  type InStatement,
  type InArgs,
  type ResultSet,
} from "@libsql/client";
import { mkdirSync } from "node:fs";
import path from "node:path";

const url = process.env.TURSO_DATABASE_URL ?? "file:./data/local.db";

// Pastikan folder untuk SQLite lokal ada sebelum client menulis file.
if (url.startsWith("file:")) {
  const filePath = url.slice("file:".length);
  mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
}

const rawClient = createClient(
  url.startsWith("file:")
    ? { url }
    : { url, authToken: process.env.TURSO_AUTH_TOKEN },
);

// Koneksi ke Turso bisa putus sementara (ConnectTimeout/fetch failed), terutama
// saat internet bermasalah — persis ketika monitoring paling dibutuhkan.
// Retry ringan agar satu koneksi gagal tidak menggagalkan scan/monitoring.
const RETRY_DELAYS_MS = [400, 800, 1600];

function isConnectError(err: unknown): boolean {
  const anyErr = err as { message?: string; cause?: { code?: string } };
  return (
    anyErr?.cause?.code === "UND_ERR_CONNECT_TIMEOUT" ||
    (typeof anyErr?.message === "string" && /fetch failed/i.test(anyErr.message))
  );
}

async function executeWithRetry(
  stmt: InStatement | string,
  args?: InArgs,
): Promise<ResultSet> {
  for (let attempt = 0; ; attempt++) {
    try {
      return typeof stmt === "string"
        ? await rawClient.execute(stmt, args)
        : await rawClient.execute(stmt);
    } catch (err) {
      const canRetry = isConnectError(err) && attempt < RETRY_DELAYS_MS.length;
      if (!canRetry) throw err;
      console.warn(
        `[db] Koneksi database gagal, retry ${attempt + 1}/${RETRY_DELAYS_MS.length}...`,
      );
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    }
  }
}

export const db = new Proxy(rawClient, {
  get(target, prop, receiver) {
    if (prop === "execute") return executeWithRetry;
    const value = Reflect.get(target, prop, receiver);
    return typeof value === "function" ? value.bind(target) : value;
  },
}) as unknown as Client;

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
  `CREATE TABLE IF NOT EXISTS device_events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id  INTEGER NOT NULL,
    status     TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
  // Migrasi ringan untuk database yang sudah ada sebelum kolom label ditambahkan.
  try {
    await db.execute("ALTER TABLE devices ADD COLUMN label TEXT");
  } catch {
    // Kolom sudah ada.
  }
}
