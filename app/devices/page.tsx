"use client";

import { useCallback, useEffect, useState } from "react";

interface Device {
  id: number;
  ip: string;
  hostname: string | null;
  mac: string | null;
  vendor: string | null;
  label: string | null;
  status: "online" | "offline";
  last_seen: string | null;
}

interface DeviceEvent {
  id: number;
  status: "online" | "offline";
  created_at: string;
}

function parseUtc(value: string): Date | null {
  if (!value) return null;
  const d = value.includes("T")
    ? new Date(value)
    : new Date(value.replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateTime(value: string): string {
  const d = parseUtc(value);
  if (!d) return value;
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [history, setHistory] = useState<Record<number, DeviceEvent[]>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/devices");
      if (res.ok) {
        const data = await res.json();
        setDevices(data.devices ?? []);
      }
    } catch {
      // abaikan — polling berikutnya akan coba lagi
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/devices/refresh", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setDevices(data.devices ?? []);
      }
    } catch {
      // abaikan
    }
  }, []);

  // Muat awal + polling ringan tiap 30 detik agar status selalu terbarui.
  useEffect(() => {
    load();
    const timer = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(timer);
  }, [load, refresh]);

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

  async function toggleHistory(id: number) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!history[id]) {
      try {
        const res = await fetch(`/api/devices/${id}/history`);
        if (res.ok) {
          const data = await res.json();
          setHistory((h) => ({ ...h, [id]: data.events ?? [] }));
        }
      } catch {
        // abaikan
      }
    }
  }

  function startEdit(d: Device) {
    setEditingId(d.id);
    setEditValue(d.label ?? d.hostname ?? "");
  }

  async function saveEdit(d: Device) {
    const value = editValue.trim();
    try {
      const res = await fetch(`/api/devices/${d.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: value }),
      });
      if (res.ok) await load();
    } catch {
      // abaikan
    } finally {
      setEditingId(null);
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
            {devices.length} perangkat · diperbarui otomatis tiap 30 dtk
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
                  <th>Nama</th>
                  <th>Vendor</th>
                  <th>MAC</th>
                  <th>Status</th>
                  <th>Last Seen</th>
                  <th>Riwayat</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => (
                  <DeviceRows
                    key={d.id}
                    device={d}
                    editingId={editingId}
                    editValue={editValue}
                    expanded={expandedId === d.id}
                    events={history[d.id]}
                    onStartEdit={() => startEdit(d)}
                    onEditChange={setEditValue}
                    onSave={() => void saveEdit(d)}
                    onCancelEdit={() => setEditingId(null)}
                    onToggleHistory={() => void toggleHistory(d.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function DeviceRows(props: {
  device: Device;
  editingId: number | null;
  editValue: string;
  expanded: boolean;
  events: DeviceEvent[] | undefined;
  onStartEdit: () => void;
  onEditChange: (v: string) => void;
  onSave: () => void;
  onCancelEdit: () => void;
  onToggleHistory: () => void;
}) {
  const d = props.device;
  const isEditing = props.editingId === d.id;
  const displayName = d.label || d.hostname;

  return (
    <>
      <tr>
        <td className="mono">{d.ip}</td>
        <td>
          {isEditing ? (
            <div className="row-inline">
              <input
                className="input"
                value={props.editValue}
                onChange={(e) => props.onEditChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") props.onSave();
                  if (e.key === "Escape") props.onCancelEdit();
                }}
                autoFocus
              />
              <button className="btn btn-sm" onClick={props.onSave}>
                Simpan
              </button>
              <button className="icon-btn" onClick={props.onCancelEdit}>
                ✕
              </button>
            </div>
          ) : (
            <div className="row-inline">
              <span className="name">{displayName ?? "-"}</span>
              {d.label && d.hostname ? (
                <span className="muted" style={{ fontSize: "0.8rem" }}>
                  {d.hostname}
                </span>
              ) : null}
              <button
                className="icon-btn"
                title="Ubah nama"
                onClick={props.onStartEdit}
              >
                ✏️
              </button>
            </div>
          )}
        </td>
        <td>{d.vendor ?? "-"}</td>
        <td className="mac">{d.mac ?? "-"}</td>
        <td>
          <span className={`badge ${d.status}`}>
            <span className="dot" />
            {d.status}
          </span>
        </td>
        <td className="muted">
          {d.last_seen ? formatDateTime(d.last_seen) : "-"}
        </td>
        <td>
          <button className="btn btn-sm" onClick={props.onToggleHistory}>
            {props.expanded ? "Tutup" : "Riwayat"}
          </button>
        </td>
      </tr>
      {props.expanded && (
        <tr className="history-row">
          <td colSpan={7}>
            <HistoryPanel events={props.events} />
          </td>
        </tr>
      )}
    </>
  );
}

function HistoryPanel({ events }: { events: DeviceEvent[] | undefined }) {
  if (!events) return <p className="muted">Memuat riwayat…</p>;
  if (events.length === 0) {
    return (
      <p className="muted">
        Belum ada riwayat. Jalankan scan untuk mulai merekam transisi online/offline.
      </p>
    );
  }
  return (
    <ul className="timeline">
      {events.map((e) => (
        <li key={e.id} className="timeline-item">
          <span className={`badge ${e.status}`}>
            <span className="dot" />
            {e.status}
          </span>
          <span className="muted">{formatDateTime(e.created_at)}</span>
        </li>
      ))}
    </ul>
  );
}
