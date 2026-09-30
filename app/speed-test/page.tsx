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
  const [provider, setProvider] = useState<"cloudflare" | "ookla">("cloudflare");
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
      const res = await fetch("/api/speed-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Gagal menjalankan speed test.");
      } else {
        await load();
      }
    } catch {
      setError("Gagal menjalankan speed test.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <header className="page-head">
        <h1>Internet Speed Test</h1>
        <p className="subtitle">Ukur kecepatan download, upload, dan latensi koneksi.</p>
      </header>

      <div className="card">
        <div className="card-head">
          <span className="icon">⚡</span>
          <h2>Jalankan Tes</h2>
        </div>
        <div className="row">
          <select
            className="select"
            value={provider}
            onChange={(e) =>
              setProvider(e.target.value as "cloudflare" | "ookla")
            }
            disabled={running}
          >
            <option value="cloudflare">Cloudflare (browser)</option>
            <option value="ookla">Ookla (khusus lokal)</option>
          </select>
          <button className="btn" onClick={run} disabled={running}>
            {running ? "Testing…" : "Mulai Speed Test"}
          </button>
        </div>
        {error && <p className="error-text">{error}</p>}
      </div>

      {results.length > 0 && (
        <div className="card">
          <div className="card-head">
            <span className="icon">📈</span>
            <h2>Grafik Kecepatan</h2>
          </div>
          <SpeedHistoryChart data={results} />
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <span className="icon">📋</span>
          <h2>Riwayat</h2>
          <div className="spacer" />
          <span className="muted" style={{ fontSize: "0.85rem" }}>
            {results.length} hasil
          </span>
        </div>
        {results.length === 0 ? (
          <div className="empty">
            <span className="empty-icon">🚀</span>
            <span>Belum ada hasil.</span>
          </div>
        ) : (
          <div className="table-scroll">
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
                    <td className="mono muted">{r.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
