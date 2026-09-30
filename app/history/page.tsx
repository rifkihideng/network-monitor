"use client";

import { useCallback, useEffect, useState } from "react";
import DowntimeChart from "@/components/history/DowntimeChart";

interface Outage {
  id: number;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
}

interface HistorySummary {
  downCount: number;
  totalDownSeconds: number;
  totalDowntime: string;
  outages: Outage[];
}

interface Day {
  date: string;
  downCount: number;
  downMinutes: number;
}

export default function HistoryPage() {
  const [summary, setSummary] = useState<HistorySummary | null>(null);
  const [daily, setDaily] = useState<Day[]>([]);

  const load = useCallback(async () => {
    const [s, d] = await Promise.all([
      fetch("/api/history").then((r) => r.json()),
      fetch("/api/history/daily").then((r) => r.json()),
    ]);
    setSummary(s);
    setDaily(d.days ?? []);
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15_000);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <div>
      <header className="page-head">
        <h1>Internet History</h1>
        <p className="subtitle">Ringkasan outage dan total downtime jaringan.</p>
      </header>

      <section className="grid">
        <div className="card stat-card">
          <div className="card-head">
            <span className="icon">🔻</span>
            <h2>Down Hari Ini</h2>
          </div>
          <p className="metric">{summary?.downCount ?? 0}×</p>
        </div>
        <div className="card stat-card">
          <div className="card-head">
            <span className="icon">⏱️</span>
            <h2>Total Downtime</h2>
          </div>
          <p className="metric">{summary?.totalDowntime ?? "0 detik"}</p>
        </div>
      </section>

      <div className="card">
        <div className="card-head">
          <span className="icon">📊</span>
          <h2>Downtime 7 Hari Terakhir</h2>
        </div>
        <DowntimeChart data={daily} />
      </div>

      <div className="card">
        <div className="card-head">
          <span className="icon">📋</span>
          <h2>Daftar Outage</h2>
        </div>
        {(summary?.outages ?? []).length === 0 ? (
          <div className="empty">
            <span className="empty-icon">✅</span>
            <span>Tidak ada outage hari ini.</span>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Mulai</th>
                  <th>Selesai</th>
                  <th>Durasi (detik)</th>
                </tr>
              </thead>
              <tbody>
                {summary?.outages.map((o) => (
                  <tr key={o.id}>
                    <td className="mono">{o.started_at ?? "-"}</td>
                    <td className="mono">{o.ended_at ?? "-"}</td>
                    <td>{o.duration_seconds ?? 0}</td>
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
