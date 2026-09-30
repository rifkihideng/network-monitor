import { execFile } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { ping, computeJitter } from "./ping";
import type { SpeedTestResult } from "./types";

const execFileAsync = promisify(execFile);

export type SpeedTestProvider = "cloudflare" | "ookla";

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

async function runCloudflareTest(): Promise<SpeedTestResult> {
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

function findSpeedtestBinary(): string | null {
  const exeName = process.platform === "win32" ? "speedtest.exe" : "speedtest";

  // 1) Dari PATH (setelah winget/shell restart).
  if (process.env.PATH) {
    for (const dir of process.env.PATH.split(path.delimiter)) {
      const candidate = path.join(dir, exeName);
      if (candidate.trim() && existsSync(candidate)) return candidate;
    }
  }

  // 2) Paket WinGet di Windows.
  try {
    const base = path.join(
      os.homedir(),
      "AppData",
      "Local",
      "Microsoft",
      "WinGet",
      "Packages",
    );
    for (const d of readdirSync(base)) {
      if (d.toLowerCase().startsWith("ookla.speedtest.cli")) {
        const exe = path.join(base, d, exeName);
        if (existsSync(exe)) return exe;
      }
    }
  } catch {
    // abaikan
  }

  return null;
}

async function runOoklaTest(): Promise<SpeedTestResult> {
  const exe = findSpeedtestBinary();
  if (!exe) {
    throw new Error(
      "Ookla CLI tidak ditemukan. Install dengan: winget install Ookla.Speedtest.CLI",
    );
  }

  const { stdout } = await execFileAsync(
    exe,
    ["--accept-license", "--accept-gdpr", "--format=json", "--progress=no"],
    { timeout: 120_000, maxBuffer: 10 * 1024 * 1024 },
  );

  // Output bisa diawali teks license; ambil bagian JSON saja.
  const start = stdout.indexOf("{");
  const end = stdout.lastIndexOf("}");
  const data = JSON.parse(stdout.slice(start, end + 1)) as {
    download?: { bandwidth?: number };
    upload?: { bandwidth?: number };
    ping?: { latency?: number; jitter?: number };
  };

  const toMbps = (bps?: number) => (bps ? (bps * 8) / 1_000_000 : 0);

  return {
    downloadMbps: toMbps(data.download?.bandwidth),
    uploadMbps: toMbps(data.upload?.bandwidth),
    pingMs: data.ping?.latency ?? null,
    jitterMs: data.ping?.jitter ?? null,
  };
}

export async function runSpeedTest(
  provider: SpeedTestProvider = "cloudflare",
): Promise<SpeedTestResult> {
  return provider === "ookla" ? runOoklaTest() : runCloudflareTest();
}
