import { ping, computeJitter } from "./ping";
import type { SpeedTestResult } from "./types";

const DOWNLOAD_URL = "https://speed.cloudflare.com/__down?bytes=25000000";
const UPLOAD_URL = "https://speed.cloudflare.com/__up";
const PING_HOST = "1.1.1.1";

async function measureDownload(): Promise<number> {
  const start = performance.now();
  const res = await fetch(DOWNLOAD_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("Download test gagal");
  const bytes = (await res.arrayBuffer()).byteLength;
  const elapsedSec = (performance.now() - start) / 1000;
  return (bytes * 8) / elapsedSec / 1_000_000; // Mbps
}

async function measureUpload(): Promise<number> {
  const payload = new Uint8Array(10_000_000); // 10 MB
  const start = performance.now();
  const res = await fetch(UPLOAD_URL, {
    method: "POST",
    body: payload,
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Upload test gagal");
  const elapsedSec = (performance.now() - start) / 1000;
  return (payload.byteLength * 8) / elapsedSec / 1_000_000; // Mbps
}

export async function runSpeedTest(): Promise<SpeedTestResult> {
  const [downloadMbps, uploadMbps] = await Promise.all([
    measureDownload(),
    measureUpload(),
  ]);

  const probes = await Promise.all(
    Array.from({ length: 6 }, () => ping(PING_HOST, 1)),
  );
  const latencies = probes
    .filter((p) => p.latencyMs !== null)
    .map((p) => p.latencyMs as number);

  const pingMs = latencies.length ? Math.min(...latencies) : null;
  const jitterMs = latencies.length > 1 ? computeJitter(latencies) : null;

  return { downloadMbps, uploadMbps, pingMs, jitterMs };
}
