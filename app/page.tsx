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
      <h1>Dashboard</h1>
      <div className="grid">
        <div className="card">
          <p className="muted">Status Koneksi</p>
          {status?.online == null ? (
            <p className="metric">-</p>
          ) : (
            <>
              <p>
                <span className={`badge ${status.online ? "online" : "offline"}`}>
                  {status.online ? "Online" : "Offline"}
                </span>
              </p>
              <p className="muted">
                Latency: {status.latencyMs != null ? `${status.latencyMs} ms` : "-"}
              </p>
              <p className="muted">
                Packet loss: {status.packetLoss != null ? `${status.packetLoss}%` : "-"}
              </p>
              <p className="muted">Cek terakhir: {status.lastChecked ?? "-"}</p>
            </>
          )}
        </div>

        <div className="card">
          <p className="muted">Internet Hari Ini</p>
          <p>
            Down <span className="metric">{history?.downCount ?? 0}</span> kali
          </p>
          <p>
            Downtime:{" "}
            <span className="metric">{history?.totalDowntime ?? "0 detik"}</span>
          </p>
        </div>

        <div className="card">
          <p className="muted">Perangkat</p>
          <p>
            <span className="metric">{status?.devicesOnline ?? 0}</span> online
          </p>
          <p className="muted">dari {status?.devicesTotal ?? 0} perangkat</p>
        </div>

        <div className="card">
          <p className="muted">Speed Test Terakhir</p>
          {latest ? (
            <>
              <p>
                ↓ <span className="metric">{latest.download.toFixed(1)}</span> Mbps
              </p>
              <p className="muted">
                ↑ {latest.upload.toFixed(1)} Mbps · Ping {latest.ping ?? "-"} ms
              </p>
              <p className="muted">{latest.created_at}</p>
            </>
          ) : (
            <p className="muted">Belum ada hasil</p>
          )}
        </div>
      </div>
    </div>
  );
}
