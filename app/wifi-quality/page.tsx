"use client";

import { useCallback, useEffect, useState } from "react";
import LatencyChart from "@/components/wifi-quality/LatencyChart";

interface WifiQuality {
  latencyMs: number | null;
  jitterMs: number | null;
  packetLoss: number;
  stabilityScore: number | null;
  samples: number;
}

interface Sample {
  created_at: string;
  latency_ms: number | null;
  packet_loss: number | null;
}

export default function WifiQualityPage() {
  const [quality, setQuality] = useState<WifiQuality | null>(null);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [probing, setProbing] = useState(false);

  const load = useCallback(async () => {
    const [q, h] = await Promise.all([
      fetch("/api/wifi-quality").then((r) => r.json()),
      fetch("/api/wifi-quality/history").then((r) => r.json()),
    ]);
    setQuality(q);
    setSamples(h.samples ?? []);
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15_000);
    return () => clearInterval(timer);
  }, [load]);

  async function probe() {
    setProbing(true);
    try {
      const res = await fetch("/api/wifi-quality", { method: "POST" });
      setQuality(await res.json());
    } finally {
      setProbing(false);
    }
  }

  return (
    <div>
      <header className="page-head">
        <h1>Wi-Fi Quality</h1>
        <p className="subtitle">Kualitas koneksi berdasarkan latency, jitter, dan packet loss.</p>
      </header>

      <div className="card">
        <div className="card-head">
          <span className="icon">🧪</span>
          <h2>Probe Jaringan</h2>
          <div className="spacer" />
          <button className="btn" onClick={probe} disabled={probing}>
            {probing ? "Probing…" : "Jalankan Probe"}
          </button>
        </div>
      </div>

      <section className="grid">
        <div className="card stat-card">
          <p className="stat-label">Latency</p>
          <p className="metric">
            {quality?.latencyMs != null ? `${quality.latencyMs} ms` : "-"}
          </p>
        </div>
        <div className="card stat-card">
          <p className="stat-label">Jitter</p>
          <p className="metric">
            {quality?.jitterMs != null ? `${quality.jitterMs} ms` : "-"}
          </p>
        </div>
        <div className="card stat-card">
          <p className="stat-label">Packet Loss</p>
          <p className="metric">{quality ? `${quality.packetLoss}%` : "-"}</p>
        </div>
        <div className="card stat-card">
          <p className="stat-label">Stability</p>
          <p className="metric">
            {quality?.stabilityScore != null ? `${quality.stabilityScore}/100` : "-"}
          </p>
        </div>
      </section>

      <div className="card">
        <div className="card-head">
          <span className="icon">📈</span>
          <h2>Riwayat Latency</h2>
        </div>
        {samples.length === 0 ? (
          <div className="empty">
            <span className="empty-icon">📉</span>
            <span>Belum ada data.</span>
          </div>
        ) : (
          <LatencyChart data={samples} />
        )}
      </div>
    </div>
  );
}
