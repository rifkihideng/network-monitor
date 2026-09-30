"use client";

import { useCallback, useEffect, useState } from "react";
import SpeedHistoryChart from "@/components/speed-test/SpeedHistoryChart";

interface SpeedTestRow {
  id: number;
  download: number;
  upload: number;
  ping: number | null;
  jitter: number | null;
  created_at: string;
}

export default function SpeedTestPage() {
  const [results, setResults] = useState<SpeedTestRow[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/speed-test");
    const data = await res.json();
    setResults(data.results ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      await fetch("/api/speed-test", { method: "POST" });
      await load();
    } catch {
      setError("Gagal menjalankan speed test.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <h1>Internet Speed Test</h1>
      <div className="card">
        <button onClick={run} disabled={running}>
          {running ? "Testing..." : "Mulai Speed Test"}
        </button>
        {error && <p className="muted">{error}</p>}
      </div>
      {results.length > 0 && (
        <div className="card">
          <h2>Grafik Kecepatan</h2>
          <SpeedHistoryChart data={results} />
        </div>
      )}
      <div className="card">
        <h2>Riwayat</h2>
        {results.length === 0 ? (
          <p className="muted">Belum ada hasil.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Download (Mbps)</th>
                <th>Upload (Mbps)</th>
                <th>Ping (ms)</th>
                <th>Jitter (ms)</th>
                <th>Waktu</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id}>
                  <td>{r.download.toFixed(2)}</td>
                  <td>{r.upload.toFixed(2)}</td>
                  <td>{r.ping ?? "-"}</td>
                  <td>{r.jitter ?? "-"}</td>
                  <td>{r.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
