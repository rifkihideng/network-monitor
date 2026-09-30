import { NextResponse } from "next/server";
import { db, initDb } from "@/lib/db/client";
import { ping, computeJitter } from "@/lib/network/ping";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PING_HOST = "1.1.1.1";

function computeStability(packetLoss: number, jitterMs: number | null): number {
  const lossPenalty = Math.min(60, packetLoss * 2);
  const jitterPenalty = Math.min(40, (jitterMs ?? 0) * 2);
  return Math.max(0, Math.round(100 - lossPenalty - jitterPenalty));
}

interface SampleRow {
  latency_ms: number | null;
  packet_loss: number | null;
  jitter_ms: number | null;
}

export async function GET() {
  await initDb();
  const { rows } = await db.execute(
    "SELECT latency_ms, packet_loss, jitter_ms FROM latency_samples ORDER BY id DESC LIMIT 100",
  );
  const samples = rows as unknown as SampleRow[];

  if (samples.length === 0) {
    return NextResponse.json({
      latencyMs: null,
      jitterMs: null,
      packetLoss: 0,
      stabilityScore: null,
      samples: 0,
    });
  }

  const latencies = samples
    .map((s) => s.latency_ms)
    .filter((v): v is number => v !== null);
  const jitters = samples
    .map((s) => s.jitter_ms)
    .filter((v): v is number => v !== null);

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

  const latencyMs = latencies.length ? Math.round(avg(latencies)) : null;
  const jitterMs = jitters.length ? Math.round(avg(jitters)) : null;
  const packetLoss = Math.round(avg(samples.map((s) => s.packet_loss ?? 0)) * 10) / 10;

  return NextResponse.json({
    latencyMs,
    jitterMs,
    packetLoss,
    stabilityScore: computeStability(packetLoss, jitterMs),
    samples: samples.length,
  });
}

export async function POST() {
  await initDb();
  const probes = await Promise.all(
    Array.from({ length: 8 }, () => ping(PING_HOST, 1)),
  );
  const latencies = probes
    .filter((p) => p.latencyMs !== null)
    .map((p) => p.latencyMs as number);

  const latencyMs = latencies.length ? Math.min(...latencies) : null;
  const jitterMs = latencies.length > 1 ? computeJitter(latencies) : null;
  const packetLoss = Math.round(
    probes.reduce((a, p) => a + p.packetLoss, 0) / probes.length,
  );

  await db.execute({
    sql: "INSERT INTO latency_samples (latency_ms, packet_loss, jitter_ms) VALUES (?, ?, ?)",
    args: [latencyMs, packetLoss, jitterMs],
  });

  return NextResponse.json({
    latencyMs,
    jitterMs,
    packetLoss,
    stabilityScore: computeStability(packetLoss, jitterMs),
  });
}
