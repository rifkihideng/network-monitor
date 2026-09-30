import { NextResponse } from "next/server";
import { db, initDb } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await initDb();

  const { rows: samples } = await db.execute(
    "SELECT latency_ms, packet_loss, created_at FROM latency_samples ORDER BY id DESC LIMIT 1",
  );
  const latest = (
    samples as unknown as Array<{
      latency_ms: number | null;
      packet_loss: number | null;
      created_at: string;
    }>
  )[0];

  const { rows: devices } = await db.execute("SELECT status FROM devices");
  const all = devices as unknown as Array<{ status: string }>;
  const devicesOnline = all.filter((d) => d.status === "online").length;

  return NextResponse.json({
    online: latest ? (latest.packet_loss ?? 0) < 100 : null,
    latencyMs: latest?.latency_ms ?? null,
    packetLoss: latest?.packet_loss ?? null,
    lastChecked: latest?.created_at ?? null,
    devicesOnline,
    devicesTotal: all.length,
  });
}
