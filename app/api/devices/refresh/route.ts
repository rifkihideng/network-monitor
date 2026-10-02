import { NextResponse } from "next/server";
import { db, initDb } from "@/lib/db/client";
import { ping } from "@/lib/network/ping";
import { scanNetwork } from "@/lib/network/scan";
import { snapshotDevices, applyOnlineStatuses } from "@/lib/devices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Refresh ringan status perangkat: baca ARP table (bukti perangkat aktif di L2)
 * + ping perangkat yang sudah dikenal. Tanpa sweep penuh supaya cepat & hemat
 * baterai — dipakai oleh polling otomatis halaman Devices.
 */
export async function POST() {
  await initDb();
  const before = await snapshotDevices();

  // Perangkat yang terlihat di ARP table = baru saja aktif → online.
  const arpDevices = await scanNetwork();
  const online = new Set(arpDevices.map((d) => d.ip));

  // Ping perangkat dikenal (bounded) untuk menangkap yang merespons ICMP.
  const ips = Array.from(before.keys());
  const concurrency = 16;
  let index = 0;

  const worker = async () => {
    while (index < ips.length) {
      const ip = ips[index++];
      if (online.has(ip)) continue;
      const probe = await ping(ip, 1, 800);
      if (probe.online) online.add(ip);
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, Math.max(1, ips.length)) },
      () => worker(),
    ),
  );

  await applyOnlineStatuses(online, before);

  const { rows } = await db.execute("SELECT * FROM devices ORDER BY ip ASC");
  return NextResponse.json({ devices: rows });
}
