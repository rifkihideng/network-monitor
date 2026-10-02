import { NextResponse } from "next/server";
import { db, initDb } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  await initDb();
  const { id } = await params;
  const { rows } = await db.execute({
    sql: "SELECT * FROM devices WHERE id = ?",
    args: [Number(id)],
  });
  if (rows.length === 0) {
    return NextResponse.json({ error: "Device tidak ditemukan" }, { status: 404 });
  }
  return NextResponse.json({ device: rows[0] });
}

export async function PATCH(req: Request, { params }: Ctx) {
  await initDb();
  const { id } = await params;
  const body = (await req.json()) ?? {};
  await db.execute({
    sql: "UPDATE devices SET hostname = COALESCE(?, hostname), label = COALESCE(?, label), status = COALESCE(?, status) WHERE id = ?",
    args: [body.hostname ?? null, body.label ?? null, body.status ?? null, Number(id)],
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  await initDb();
  const { id } = await params;
  await db.execute({ sql: "DELETE FROM devices WHERE id = ?", args: [Number(id)] });
  return NextResponse.json({ ok: true });
}
