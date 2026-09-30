import { NextResponse } from "next/server";
import { db, initDb } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await initDb();
  const { rows } = await db.execute(
    "SELECT created_at, latency_ms, packet_loss, jitter_ms FROM latency_samples ORDER BY id DESC LIMIT 100",
  );
  const samples = (
    rows as unknown as Array<{
      created_at: string;
      latency_ms: number | null;
      packet_loss: number | null;
      jitter_ms: number | null;
    }>
  ).reverse();
  return NextResponse.json({ samples });
}
