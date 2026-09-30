import { runMonitorTick } from "./monitor";

const DEFAULT_INTERVAL_MS = 60_000;

let started = false;

/**
 * Scheduler lokal untuk dev & self-hosted (`next dev` / `next start`).
 * Di Vercel, monitoring dijalankan lewat Vercel Cron yang memanggil /api/monitor,
 * jadi loop ini dilewati (serverless tidak bisa menjalankan proses lama).
 */
export function startMonitorLoop(): void {
  if (started) return;
  started = true;

  if (process.env.VERCEL) {
    console.log("[monitor] Berjalan di Vercel — gunakan Vercel Cron untuk /api/monitor");
    return;
  }
  if (process.env.MONITOR_ENABLED === "false") {
    console.log("[monitor] Dinonaktifkan (MONITOR_ENABLED=false)");
    return;
  }

  const parsed = Number(process.env.MONITOR_INTERVAL_MS);
  const intervalMs = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_INTERVAL_MS;
  const safeInterval = Math.max(10_000, intervalMs);

  const tick = async () => {
    try {
      const result = await runMonitorTick();
      console.log(
        `[monitor] ${result.online ? "online" : "DOWN"} | latency=${result.latencyMs ?? "-"}ms ` +
          `loss=${result.packetLoss}% | transition=${result.transition}`,
      );
    } catch (err) {
      console.error("[monitor] Tick gagal:", err);
    }
  };

  // Tick pertama dijadwalkan, tidak memblokir startup server.
  setTimeout(() => void tick(), 1000);
  const timer = setInterval(() => void tick(), safeInterval);
  if (typeof timer.unref === "function") timer.unref();

  console.log(
    `[monitor] Loop aktif setiap ${safeInterval}ms (host: ${process.env.MONITOR_HOST ?? "1.1.1.1"})`,
  );
}
