import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { PingResult } from "./types";

const execFileAsync = promisify(execFile);

export function computeJitter(samples: number[]): number {
  if (samples.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < samples.length; i++) {
    total += Math.abs(samples[i] - samples[i - 1]);
  }
  return total / (samples.length - 1);
}

function parsePing(output: string, host: string): PingResult {
  // Ambil semua latency dari baris "Reply": time=12ms atau time<1ms
  const times = Array.from(output.matchAll(/time[=<>](\d+)\s*ms/gi)).map((m) =>
    Number(m[1]),
  );
  const latencyMs = times.length
    ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
    : null;

  // Packet loss: "(0% loss)" atau "(0% hilang)" / "100% loss"
  const lossMatch =
    output.match(/\((\d+)%\s*(?:loss|hilang)\)/i) ??
    output.match(/(\d+)%\s*(?:loss|hilang)/i);
  const packetLoss = lossMatch
    ? Number(lossMatch[1])
    : times.length
      ? 0
      : 100;

  return { host, online: packetLoss < 100, latencyMs, packetLoss };
}

/**
 * Probe konektivitas via HTTPS (GET /cdn-cgi/trace pada host Cloudflare).
 * Dipakai sebagai fallback saat ICMP ping diblokir (mis. Vercel serverless
 * tidak mengizinkan ICMP, tapi akses HTTPS tetap boleh).
 */
async function httpProbe(host: string, timeoutMs: number): Promise<PingResult> {
  const url = `https://${host}/cdn-cgi/trace`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
    });
    if (res.ok) {
      const latencyMs = Math.max(1, Math.round(Date.now() - started));
      void res.body?.cancel();
      return { host, online: true, latencyMs, packetLoss: 0 };
    }
    return { host, online: false, latencyMs: null, packetLoss: 100 };
  } catch {
    return { host, online: false, latencyMs: null, packetLoss: 100 };
  } finally {
    clearTimeout(timer);
  }
}

export async function ping(
  host: string,
  count = 4,
  timeoutMs = 3000,
): Promise<PingResult> {
  const isWin = process.platform === "win32";
  const args = isWin
    ? ["-n", String(count), "-w", String(timeoutMs), host]
    : ["-c", String(count), "-W", String(Math.max(1, Math.ceil(timeoutMs / 1000))), host];

  let result: PingResult;
  try {
    const { stdout } = await execFileAsync("ping", args, {
      timeout: timeoutMs + 500,
    });
    result = parsePing(stdout, host);
  } catch (err) {
    // Ping exit non-zero saat ada packet loss / host unreachable, stdout tetap bisa dipakai.
    const out = (err as { stdout?: string })?.stdout ?? "";
    result = out
      ? parsePing(out, host)
      : { host, online: false, latencyMs: null, packetLoss: 100 };
  }

  // ICMP bisa diblokir (Vercel, jaringan tertentu) sehingga hasilnya "100% loss"
  // padahal internet sebenarnya tersedia. Coba konfirmasi lewat HTTP.
  if (!result.online) {
    const http = await httpProbe(host, timeoutMs);
    if (http.online) return http;
  }
  return result;
}
