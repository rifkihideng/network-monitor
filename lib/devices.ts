import { db } from "./db/client";

export interface DeviceRow {
  id: number;
  ip: string;
  status: string;
}

/** Ambil snapshot status perangkat saat ini (ip -> {id, status}). */
export async function snapshotDevices(): Promise<Map<string, DeviceRow>> {
  const { rows } = await db.execute("SELECT id, ip, status FROM devices");
  const map = new Map<string, DeviceRow>();
  for (const r of rows as unknown as DeviceRow[]) map.set(r.ip, r);
  return map;
}

/**
 * Terapkan status online/offline berdasarkan daftar IP yang sedang online,
 * lalu catat transisinya ke tabel `device_events`.
 * `before` adalah snapshot status SEBELUM perubahan (untuk deteksi transisi).
 */
export async function applyOnlineStatuses(
  onlineIps: Set<string>,
  before: Map<string, DeviceRow>,
): Promise<void> {
  const now = new Date().toISOString();

  for (const ip of onlineIps) {
    const prev = before.get(ip);
    await db.execute({
      sql: "UPDATE devices SET status = 'online', last_seen = ? WHERE ip = ?",
      args: [now, ip],
    });

    if (!prev || prev.status !== "online") {
      let id = prev?.id;
      if (!id) {
        // Perangkat baru (belum ada di snapshot) — cari id hasil upsert.
        const { rows } = await db.execute({
          sql: "SELECT id FROM devices WHERE ip = ?",
          args: [ip],
        });
        id = (rows as unknown as Array<{ id: number }>)[0]?.id;
      }
      if (id) {
        await db.execute({
          sql: "INSERT INTO device_events (device_id, status) VALUES (?, 'online')",
          args: [id],
        });
      }
    }
  }

  for (const [ip, prev] of before) {
    if (!onlineIps.has(ip) && prev.status === "online") {
      await db.execute({
        sql: "UPDATE devices SET status = 'offline' WHERE id = ?",
        args: [prev.id],
      });
      await db.execute({
        sql: "INSERT INTO device_events (device_id, status) VALUES (?, 'offline')",
        args: [prev.id],
      });
    }
  }
}
