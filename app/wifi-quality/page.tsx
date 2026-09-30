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
      <h1>Wi-Fi Quality</h1>
      <div className="card">
        <button onClick={probe} disabled={probing}>
          {probing ? "Probing..." : "Jalankan Probe"}
        </button>
      </div>
      <div className="card">
        <h2>Ringkasan</h2>
        <table>
          <tbody>
            <tr>
              <th>Latency</th>
              <td>{quality?.latencyMs != null ? `${quality.latencyMs} ms` : "-"}</td>
            </tr>
            <tr>
              <th>Jitter</th>
              <td>{quality?.jitterMs != null ? `${quality.jitterMs} ms` : "-"}</td>
            </tr>
            <tr>
              <th>Packet Loss</th>
              <td>{quality ? `${quality.packetLoss}%` : "-"}</td>
            </tr>
            <tr>
              <th>Connection Stability</th>
              <td>
                {quality?.stabilityScore != null
                  ? `${quality.stabilityScore}/100`
                  : "-"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="card">
        <h2>Riwayat Latency</h2>
        {samples.length === 0 ? (
          <p className="muted">Belum ada data.</p>
        ) : (
          <LatencyChart data={samples} />
        )}
      </div>
    </div>
  );
}
