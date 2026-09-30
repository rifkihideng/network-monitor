import { NextResponse } from "next/server";
import { db, initDb } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DayRow {
  day: string;
  down_count: number;
  down_seconds: number;
}

export async function GET() {
  await initDb();
  const days = 7;

  const { rows } = await db.execute({
    sql: `SELECT date(started_at) AS day,
                 COUNT(*) AS down_count,
                 SUM(COALESCE(duration_seconds, 0)) AS down_seconds
          FROM outages
          WHERE started_at >= datetime('now', ?)
          GROUP BY date(started_at)
          ORDER BY day ASC`,
    args: [`-${days} days`],
  });

  const map = new Map<string, DayRow>();
  for (const r of rows as unknown as DayRow[]) {
    map.set(r.day, r);
  }

  const result: Array<{
    date: string;
    downCount: number;
    downMinutes: number;
  }> = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    const row = map.get(key);
    result.push({
      date: key,
      downCount: row?.down_count ?? 0,
      downMinutes: Math.round((row?.down_seconds ?? 0) / 60),
    });
  }

  return NextResponse.json({ days: result });
}
