import { NextResponse } from "next/server";
import { db, initDb } from "@/lib/db/client";
import { fullScan, resolveHostname } from "@/lib/network/scan";
import { discoverMdnsDevices } from "@/lib/network/mdns";
import { lookupVendor } from "@/lib/network/oui";
import type { ScannedDevice } from "@/lib/network/types";

function mergeDevices(
  arp: ScannedDevice[],
  mdns: ScannedDevice[],
): ScannedDevice[] {
  const byIp = new Map<string, ScannedDevice>();
  for (const d of arp) byIp.set(d.ip, { ...d });
  for (const m of mdns) {
    const existing = byIp.get(m.ip);
    if (existing) {
      existing.hostname = existing.hostname ?? m.hostname;
      existing.mac = existing.mac ?? m.mac;
    } else {
      byIp.set(m.ip, { ...m });
    }
  }
  return Array.from(byIp.values());
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await initDb();
  const { rows } = await db.execute("SELECT * FROM devices ORDER BY ip ASC");
  return NextResponse.json({ devices: rows });
}

export async function POST() {
  await initDb();
  const [arpDevices, mdnsDevices] = await Promise.all([
    fullScan(),
    discoverMdnsDevices(4000),
  ]);

  // Gabungkan hasil ARP + mDNS berdasarkan IP (hostname mDNS mengisi yang kosong).
  const scanned = mergeDevices(arpDevices, mdnsDevices);

  const vendorResults = await Promise.allSettled(
    scanned.map((d) => (d.mac ? lookupVendor(d.mac) : Promise.resolve(null))),
  );

  // Perangkat yang ditemukan pada scan ini baru saja terlihat di jaringan → online.
  // (Tabel ARP & mDNS hanya memuat perangkat yang aktif. Banyak perangkat memblokir
  // ICMP, sehingga pengecekan ping justru menandai perangkat hidup sebagai offline.)
  const enriched = await Promise.all(
    scanned.map(async (d, i) => {
      const vr = vendorResults[i];
      return {
        ip: d.ip,
        mac: d.mac,
        hostname: d.hostname ? d.hostname : await resolveHostname(d.ip, 800),
        vendor: vr.status === "fulfilled" ? vr.value : null,
        online: true,
      };
    }),
  );

  // Tulis ke DB berurutan agar aman dari lock SQLite.
  const devices = [];
  const now = new Date().toISOString();
  for (const info of enriched) {
    await db.execute({
      sql: `INSERT INTO devices (ip, hostname, mac, vendor, status, last_seen)
            VALUES (?, ?, ?, ?, 'online', ?)
            ON CONFLICT(ip) DO UPDATE SET
              hostname = excluded.hostname,
              mac = excluded.mac,
              vendor = excluded.vendor,
              status = 'online',
              last_seen = excluded.last_seen`,
      args: [info.ip, info.hostname, info.mac, info.vendor, now],
    });

    devices.push({
      ip: info.ip,
      hostname: info.hostname,
      mac: info.mac,
      vendor: info.vendor,
      status: "online",
    });
  }

  // Perangkat yang tidak terlihat pada scan ini ditandai offline.
  const discoveredIps = new Set(enriched.map((d) => d.ip));
  const { rows: existingRows } = await db.execute("SELECT ip FROM devices");
  for (const row of existingRows as unknown as Array<{ ip: string }>) {
    if (!discoveredIps.has(row.ip)) {
      await db.execute({
        sql: "UPDATE devices SET status = 'offline' WHERE ip = ?",
        args: [row.ip],
      });
    }
  }

  return NextResponse.json({ devices });
}
