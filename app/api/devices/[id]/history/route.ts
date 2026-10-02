import { NextResponse } from "next/server";
import { db, initDb } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Riwayat online/offline sebuah perangkat (transisi status). */
export async function GET(_req: Request, { params }: Ctx) {
  await initDb();
  const { id } = await params;
  const { rows } = await db.execute({
    sql: "SELECT id, status, created_at FROM device_events WHERE device_id = ? ORDER BY id DESC LIMIT 100",
    args: [Number(id)],
  });
  return NextResponse.json({ events: rows });
}
