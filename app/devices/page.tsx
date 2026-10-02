"use client";

import { useCallback, useEffect, useState } from "react";

interface Device {
  id: number;
  ip: string;
  hostname: string | null;
  mac: string | null;
  vendor: string | null;
  status: "online" | "offline";
  last_seen: string | null;
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/devices");
    const data = await res.json();
    setDevices(data.devices ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function scan() {
    setScanning(true);
    setError(null);
    try {
      const res = await fetch("/api/devices", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(
          (data as { error?: string } | null)?.error ??
            `Scan gagal (HTTP ${res.status})`,
        );
        return;
      }
      await load();
    } catch {
      setError("Scan gagal — periksa koneksi atau coba lagi.");
    } finally {
      setScanning(false);
    }
  }

  return (
    <div>
      <header className="page-head">
        <h1>Device Monitor</h1>
        <p className="subtitle">Deteksi dan pantau perangkat di jaringan lokal.</p>
      </header>

      <div className="card">
        <div className="card-head">
          <span className="icon">📡</span>
          <h2>Pemindaian Jaringan</h2>
          <div className="spacer" />
          <button className="btn" onClick={scan} disabled={scanning}>
            {scanning ? "Scanning…" : "Scan Perangkat"}
          </button>
        </div>
        {error && <p className="error-text">{error}</p>}
      </div>

      <div className="card">
        <div className="card-head">
          <span className="icon">🖥️</span>
          <h2>Perangkat di Jaringan</h2>
          <div className="spacer" />
          <span className="muted" style={{ fontSize: "0.85rem" }}>
            {devices.length} perangkat
          </span>
        </div>
        {devices.length === 0 ? (
          <div className="empty">
            <span className="empty-icon">📭</span>
            <span>Belum ada perangkat. Klik “Scan Perangkat”.</span>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>IP Address</th>
                  <th>Hostname</th>
                  <th>Vendor</th>
                  <th>MAC</th>
                  <th>Status</th>
                  <th>Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => (
                  <tr key={d.id}>
                    <td className="mono">{d.ip}</td>
                    <td>{d.hostname ?? "-"}</td>
                    <td>{d.vendor ?? "-"}</td>
                    <td className="mac">{d.mac ?? "-"}</td>
                    <td>
                      <span className={`badge ${d.status}`}>
                        <span className="dot" />
                        {d.status}
                      </span>
                    </td>
                    <td className="muted">{d.last_seen ?? "-"}</td>
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
