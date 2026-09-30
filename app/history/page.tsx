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
      <h1>Internet History</h1>
      <div className="card">
        <p className="muted">Ringkasan hari ini</p>
        <p>
          Internet down <span className="metric">{summary?.downCount ?? 0}</span> kali
        </p>
        <p>
          Total downtime:{" "}
          <span className="metric">{summary?.totalDowntime ?? "0 detik"}</span>
        </p>
      </div>
      <div className="card">
        <h2>Downtime 7 Hari Terakhir</h2>
        <DowntimeChart data={daily} />
      </div>
      <div className="card">
        <h2>Daftar Outage</h2>
        <table>
          <thead>
            <tr>
              <th>Mulai</th>
              <th>Selesai</th>
              <th>Durasi (detik)</th>
            </tr>
          </thead>
          <tbody>
            {(summary?.outages ?? []).length === 0 ? (
              <tr>
                <td colSpan={3} className="muted">
                  Tidak ada outage hari ini.
                </td>
              </tr>
            ) : (
              summary?.outages.map((o) => (
                <tr key={o.id}>
                  <td>{o.started_at ?? "-"}</td>
                  <td>{o.ended_at ?? "-"}</td>
                  <td>{o.duration_seconds ?? 0}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
