"use client";

import { useEffect, useState } from "react";

interface Status {
  online: boolean | null;
  latencyMs: number | null;
  packetLoss: number | null;
  lastChecked: string | null;
  devicesOnline: number;
  devicesTotal: number;
}

interface HistorySummary {
  downCount: number;
  totalDowntime: string;
}

interface SpeedRow {
  download: number;
  upload: number;
  ping: number | null;
  jitter: number | null;
  created_at: string;
}

export default function HomePage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [history, setHistory] = useState<HistorySummary | null>(null);
  const [latest, setLatest] = useState<SpeedRow | null>(null);

  useEffect(() => {
    const load = async () => {
      const [s, h, sp] = await Promise.all([
        fetch("/api/status").then((r) => r.json()),
        fetch("/api/history").then((r) => r.json()),
        fetch("/api/speed-test").then((r) => r.json()),
      ]);
      setStatus(s);
      setHistory(h);
      setLatest(sp.results?.[0] ?? null);
    };
    load();
    const timer = setInterval(load, 15_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div>
      <header className="page-head">
        <h1>Dashboard</h1>
        <p className="subtitle">
          Pantau status koneksi, perangkat, dan kualitas jaringan secara real-time.
        </p>
      </header>

      <section className="card hero">
        <div>
          <p className="muted" style={{ marginBottom: 6 }}>
            Status Koneksi
          </p>
          {status?.online == null ? (
            <span className="badge offline">
              <span className="dot" />
              Memuat…
            </span>
          ) : (
            <span className={`badge ${status.online ? "online" : "offline"}`}>
              <span className="dot" />
              {status.online ? "Online" : "Offline"}
            </span>
          )}
        </div>
        <div className="hero-metrics">
          <div className="mini-stat">
            <span className="mini-label">Latency</span>
            <span className="mini-value">
              {status?.latencyMs != null ? `${status.latencyMs} ms` : "-"}
            </span>
          </div>
          <div className="mini-stat">
            <span className="mini-label">Packet Loss</span>
            <span className="mini-value">
              {status?.packetLoss != null ? `${status.packetLoss}%` : "-"}
            </span>
          </div>
          <div className="mini-stat">
            <span className="mini-label">Cek Terakhir</span>
            <span className="mini-value" style={{ fontSize: "0.82rem" }}>
              {status?.lastChecked ?? "-"}
            </span>
          </div>
        </div>
      </section>

      <section className="grid">
        <div className="card stat-card">
          <div className="card-head">
            <span className="icon">🕒</span>
            <h2>Internet Hari Ini</h2>
          </div>
          <p className="stat-label">Down</p>
          <p className="metric">{history?.downCount ?? 0}×</p>
          <p className="muted">Downtime {history?.totalDowntime ?? "0 detik"}</p>
        </div>

        <div className="card stat-card">
          <div className="card-head">
            <span className="icon">🖥️</span>
            <h2>Perangkat</h2>
          </div>
          <p className="stat-label">Online</p>
          <p className="metric">{status?.devicesOnline ?? 0}</p>
          <p className="muted">dari {status?.devicesTotal ?? 0} perangkat</p>
        </div>

        <div className="card stat-card">
          <div className="card-head">
            <span className="icon">⚡</span>
            <h2>Speed Test Terakhir</h2>
          </div>
          {latest ? (
            <>
              <p className="stat-label">Download</p>
              <p className="metric">{latest.download.toFixed(1)} Mbps</p>
              <p className="muted">
                ↑ {latest.upload.toFixed(1)} Mbps · Ping {latest.ping ?? "-"} ms
              </p>
            </>
          ) : (
            <>
              <p className="stat-label">Belum ada hasil</p>
              <p className="metric">-</p>
              <p className="muted">Jalankan speed test untuk melihatnya.</p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
