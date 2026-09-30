import { NextResponse } from "next/server";
import { db, initDb } from "@/lib/db/client";
import { ping } from "@/lib/network/ping";
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
  const mdnsIps = new Set(mdnsDevices.map((d) => d.ip));

  const vendorResults = await Promise.allSettled(
    scanned.map((d) => (d.mac ? lookupVendor(d.mac) : Promise.resolve(null))),
  );

  // Proses ping + reverse DNS secara paralel (bounded) agar scan cepat.
  const enriched: Array<{
    ip: string;
    mac: string | null;
    hostname: string | null;
    vendor: string | null;
    online: boolean;
  }> = [];

  const concurrency = 16;
  let index = 0;

  const worker = async () => {
    while (index < scanned.length) {
      const i = index++;
      const dev = scanned[i];
      const [probe, hostname] = await Promise.all([
        ping(dev.ip, 1, 800),
        dev.hostname ? Promise.resolve(dev.hostname) : resolveHostname(dev.ip, 800),
      ]);
      const vr = vendorResults[i];
      const vendor = vr.status === "fulfilled" ? vr.value : null;
      enriched.push({
        ip: dev.ip,
        mac: dev.mac,
        hostname,
        vendor,
        // mDNS baru saja melihat perangkat → anggap online walau ping diblokir.
        online: probe.online || mdnsIps.has(dev.ip),
      });
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, scanned.length) }, () => worker()),
  );

  // Tulis ke DB berurutan agar aman dari lock SQLite.
  const devices = [];
  for (const info of enriched) {
    const status = info.online ? "online" : "offline";
    const lastSeen = info.online ? new Date().toISOString() : null;

    await db.execute({
      sql: `INSERT INTO devices (ip, hostname, mac, vendor, status, last_seen)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(ip) DO UPDATE SET
              hostname = excluded.hostname,
              mac = excluded.mac,
              vendor = excluded.vendor,
              status = excluded.status,
              last_seen = COALESCE(excluded.last_seen, devices.last_seen)`,
      args: [info.ip, info.hostname, info.mac, info.vendor, status, lastSeen],
    });

    devices.push({
      ip: info.ip,
      hostname: info.hostname,
      mac: info.mac,
      vendor: info.vendor,
      status,
    });
  }

  return NextResponse.json({ devices });
}
