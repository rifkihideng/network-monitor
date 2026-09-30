import { NextResponse } from "next/server";
import { db, initDb } from "@/lib/db/client";
import { todayStartIso, nowIso, formatDuration } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await initDb();
  const { rows } = await db.execute({
    sql: "SELECT * FROM outages WHERE started_at >= ? ORDER BY started_at DESC",
    args: [todayStartIso()],
  });

  const outages = rows as unknown as Array<{
    id: number;
    started_at: string | null;
    ended_at: string | null;
    duration_seconds: number | null;
  }>;

  const totalDownSeconds = outages.reduce(
    (acc, o) => acc + (o.duration_seconds ?? 0),
    0,
  );

  return NextResponse.json({
    downCount: outages.length,
    totalDownSeconds,
    totalDowntime: formatDuration(totalDownSeconds),
    outages,
  });
}

// Catat kejadian outage secara manual (atau dari detector di masa depan).
export async function POST(req: Request) {
  await initDb();
  const body = (await req.json()) ?? {};
  const startedAt = body.startedAt ?? nowIso();
  const endedAt = body.endedAt ?? nowIso();
  const durationSeconds = Math.max(
    0,
    Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 1000),
  );

  await db.execute({
    sql: "INSERT INTO outages (started_at, ended_at, duration_seconds) VALUES (?, ?, ?)",
    args: [startedAt, endedAt, durationSeconds],
  });

  return NextResponse.json({ ok: true, durationSeconds });
}
