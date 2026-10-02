import { NextResponse } from "next/server";
import { db, initDb } from "@/lib/db/client";
import { fullScan, resolveHostname } from "@/lib/network/scan";
import { discoverMdnsDevices } from "@/lib/network/mdns";
import { lookupVendor } from "@/lib/network/oui";
import { snapshotDevices, applyOnlineStatuses } from "@/lib/devices";
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

  // Di Vercel (serverless), scan ARP/ping-sweep/mDNS terjadi di datacenter
  // Vercel — bukan LAN rumah — sehingga tidak berguna dan hanya menyedot
  // memori (ping sweep 128 konkuren). Monitoring perangkat tetap dijalankan
  // dari mesin lokal (Windows) yang menulis ke Turso.
  if (process.env.VERCEL) {
    const { rows } = await db.execute("SELECT * FROM devices ORDER BY ip ASC");
    return NextResponse.json({ devices: rows, source: "db" });
  }

  // Snapshot status sebelum scan untuk mendeteksi transisi online/offline.
  const before = await snapshotDevices();

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

  // Terapkan status online/offline + catat transisi ke device_events.
  const onlineIps = new Set(enriched.map((d) => d.ip));
  await applyOnlineStatuses(onlineIps, before);

  return NextResponse.json({ devices });
}
