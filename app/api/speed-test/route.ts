import { NextResponse } from "next/server";
import { db, initDb } from "@/lib/db/client";
import { runSpeedTest } from "@/lib/network/speedtest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await initDb();
  const { rows } = await db.execute(
    "SELECT * FROM speed_tests ORDER BY id DESC LIMIT 20",
  );
  return NextResponse.json({ results: rows });
}

export async function POST(req: Request) {
  await initDb();
  const body = await req.json().catch(() => ({}));
  const provider = body.provider === "ookla" ? "ookla" : "fast";

  try {
    const result = await runSpeedTest(provider);
    await db.execute({
      sql: "INSERT INTO speed_tests (download, upload, ping, jitter) VALUES (?, ?, ?, ?)",
      args: [result.downloadMbps, result.uploadMbps, result.pingMs, result.jitterMs],
    });
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Speed test gagal" },
      { status: 400 },
    );
  }
}
