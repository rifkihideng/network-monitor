import { NextResponse } from "next/server";
import { runMonitorTick } from "@/lib/monitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Dipanggil oleh Vercel Cron (lihat vercel.json). Jika CRON_SECRET diisi,
// endpoint ini menolak request tanpa header Authorization yang cocok.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await runMonitorTick();
  return NextResponse.json(result);
}
