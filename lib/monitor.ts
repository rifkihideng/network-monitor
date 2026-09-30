import { db, initDb } from "./db/client";
import { ping, computeJitter } from "./network/ping";

export const MONITOR_HOST = process.env.MONITOR_HOST ?? "1.1.1.1";
export const MONITOR_PROBES = 3;

export interface OutageInfo {
  id: number;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
}

export interface MonitorTickResult {
  checkedAt: string;
  online: boolean;
  latencyMs: number | null;
  jitterMs: number | null;
  packetLoss: number;
  transition: "none" | "down" | "up";
  outage: OutageInfo | null;
}

interface OpenOutageRow {
  id: number;
  started_at: string;
}

/**
 * Satu "tick" monitoring:
 * 1. Ping host internet beberapa kali → hitung latency/jitter/packet loss.
 * 2. Simpan sampel ke latency_samples (feed halaman Wi-Fi Quality).
 * 3. Deteksi transisi down/up berdasarkan keberadaan outage yang masih terbuka:
 *    - online + ada outage terbuka  → internet baru pulih (tutup outage).
 *    - offline + tidak ada outage    → internet baru down (buka outage).
 */
export async function runMonitorTick(): Promise<MonitorTickResult> {
  await initDb();
  const checkedAt = new Date().toISOString();

  const probes = await Promise.all(
    Array.from({ length: MONITOR_PROBES }, () => ping(MONITOR_HOST, 1)),
  );
  const latencies = probes
    .filter((p) => p.latencyMs !== null)
    .map((p) => p.latencyMs as number);

  const latencyMs = latencies.length ? Math.min(...latencies) : null;
  const jitterMs = latencies.length > 1 ? computeJitter(latencies) : null;
  const packetLoss = Math.round(
    probes.reduce((acc, p) => acc + p.packetLoss, 0) / probes.length,
  );
  const online = packetLoss < 100;

  await db.execute({
    sql: "INSERT INTO latency_samples (latency_ms, packet_loss, jitter_ms) VALUES (?, ?, ?)",
    args: [latencyMs, packetLoss, jitterMs],
  });

  const { rows } = await db.execute(
    "SELECT id, started_at FROM outages WHERE ended_at IS NULL ORDER BY id DESC LIMIT 1",
  );
  const openOutage = (rows as unknown as OpenOutageRow[])[0];

  let transition: MonitorTickResult["transition"] = "none";
  let outage: OutageInfo | null = null;

  if (online) {
    if (openOutage) {
      const endedAt = new Date().toISOString();
      const durationSeconds = Math.max(
        0,
        Math.round(
          (Date.parse(endedAt) - Date.parse(openOutage.started_at)) / 1000,
        ),
      );
      await db.execute({
        sql: "UPDATE outages SET ended_at = ?, duration_seconds = ? WHERE id = ?",
        args: [endedAt, durationSeconds, openOutage.id],
      });
      transition = "up";
      outage = {
        id: openOutage.id,
        startedAt: openOutage.started_at,
        endedAt,
        durationSeconds,
      };
    }
  } else if (!openOutage) {
    await db.execute({
      sql: "INSERT INTO outages (started_at, ended_at, duration_seconds) VALUES (?, NULL, NULL)",
      args: [checkedAt],
    });
    const { rows: created } = await db.execute(
      "SELECT id, started_at FROM outages WHERE ended_at IS NULL ORDER BY id DESC LIMIT 1",
    );
    const createdOutage = (created as unknown as OpenOutageRow[])[0];
    transition = "down";
    outage = createdOutage
      ? {
          id: createdOutage.id,
          startedAt: createdOutage.started_at,
          endedAt: null,
          durationSeconds: null,
        }
      : null;
  }

  return { checkedAt, online, latencyMs, jitterMs, packetLoss, transition, outage };
}
