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
    try {
      await fetch("/api/devices", { method: "POST" });
      await load();
    } finally {
      setScanning(false);
    }
  }

  return (
    <div>
      <h1>Device Monitor</h1>
      <div className="card">
        <button onClick={scan} disabled={scanning}>
          {scanning ? "Scanning..." : "Scan Perangkat"}
        </button>
      </div>
      <div className="card">
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
            {devices.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  Belum ada perangkat. Klik &quot;Scan Perangkat&quot;.
                </td>
              </tr>
            ) : (
              devices.map((d) => (
                <tr key={d.id}>
                  <td>{d.ip}</td>
                  <td>{d.hostname ?? "-"}</td>
                  <td>{d.vendor ?? "-"}</td>
                  <td>{d.mac ?? "-"}</td>
                  <td>
                    <span className={`badge ${d.status}`}>{d.status}</span>
                  </td>
                  <td>{d.last_seen ?? "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
