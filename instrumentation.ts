export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startMonitorLoop } = await import("./lib/monitor-loop");
    // Jangan jalankan loop saat proses build.
    if (process.env.NEXT_PHASE !== "phase-production-build") {
      startMonitorLoop();
    }
  }
}
