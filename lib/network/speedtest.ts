import { execFile } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { ping, computeJitter } from "./ping";
import type { SpeedTestResult } from "./types";

const execFileAsync = promisify(execFile);

export type SpeedTestProvider = "fast" | "ookla";

const FAST_APP_URL = "https://fast.com";
const FAST_API_URL = "https://api.fast.com/netflix/speedtest";
const PING_HOST = "8.8.8.8";
const DOWNLOAD_DURATION_MS = 6000;
const UPLOAD_BYTES = 10_000_000;

async function getFastTargets(): Promise<string[]> {
  const html = await (await fetch(FAST_APP_URL, { cache: "no-store" })).text();
  const scriptMatch = html.match(/src="(\/app-[^"]+\.js)"/);
  if (!scriptMatch) throw new Error("Gagal membaca halaman fast.com");

  const jsUrl = "https://fast.com" + scriptMatch[1];
  const js = await (await fetch(jsUrl, { cache: "no-store" })).text();
  const token = js.match(/token:"([^"]+)"/)?.[1];
  if (!token) throw new Error("Gagal mengambil token fast.com");
  const urlCount = js.match(/urlCount:(\d+)/)?.[1] ?? "5";

  const apiUrl = `${FAST_API_URL}?https=true&token=${encodeURIComponent(
    token,
  )}&urlCount=${urlCount}`;
  const res = await fetch(apiUrl, { cache: "no-store" });
  if (!res.ok) throw new Error("Gagal mengambil server fast.com");
  const data = (await res.json()) as Array<{ url?: string }>;
  const urls = data.map((t) => t.url).filter((u): u is string => Boolean(u));
  if (urls.length === 0) throw new Error("Tidak ada server fast.com");
  return urls;
}

async function measureFastDownload(urls: string[]): Promise<number> {
  const controller = new AbortController();
  const started = performance.now();
  let totalBytes = 0;

  const download = async (url: string) => {
    try {
      const res = await fetch(url, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok || !res.body) return;
      const reader = res.body.getReader();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
      }
    } catch {
      // dibatalkan saat durasi habis — wajar
    }
  };

  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      controller.abort();
      resolve();
    }, DOWNLOAD_DURATION_MS);
    Promise.allSettled(urls.map(download)).then(() => {
      clearTimeout(timer);
      resolve();
    });
  });

  const elapsedSec = (performance.now() - started) / 1000;
  const mbps = (totalBytes * 8) / elapsedSec / 1_000_000;
  if (!Number.isFinite(mbps) || mbps <= 0) throw new Error("Download test gagal");
  return mbps;
}

async function measureFastUpload(url: string): Promise<number> {
  const payload = new Uint8Array(UPLOAD_BYTES);
  const started = performance.now();
  const res = await fetch(url, {
    method: "POST",
    body: payload,
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Upload test gagal");
  const elapsedSec = (performance.now() - started) / 1000;
  return (payload.byteLength * 8) / elapsedSec / 1_000_000;
}

async function runFastTest(): Promise<SpeedTestResult> {
  const urls = await getFastTargets();

  const [downloadMbps, uploadMbps] = await Promise.all([
    measureFastDownload(urls),
    measureFastUpload(urls[0]),
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
  provider: SpeedTestProvider = "fast",
): Promise<SpeedTestResult> {
  return provider === "ookla" ? runOoklaTest() : runFastTest();
}
