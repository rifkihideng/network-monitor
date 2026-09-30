"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface Sample {
  created_at: string;
  latency_ms: number | null;
  packet_loss: number | null;
}

function formatTime(value: string): string {
  const m = value.match(/T?(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : value;
}

export default function LatencyChart({ data }: { data: Sample[] }) {
  const points = data.map((s) => ({
    time: formatTime(s.created_at),
    latency: s.latency_ms ?? null,
    loss: s.packet_loss ?? 0,
  }));

  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} />
          <YAxis yAxisId="lat" stroke="#94a3b8" fontSize={11} unit="ms" />
          <YAxis yAxisId="loss" orientation="right" stroke="#94a3b8" fontSize={11} unit="%" />
          <Tooltip />
          <Line
            yAxisId="lat"
            type="monotone"
            dataKey="latency"
            name="Latency"
            stroke="#38bdf8"
            dot={false}
            connectNulls
          />
          <Line
            yAxisId="loss"
            type="monotone"
            dataKey="loss"
            name="Packet loss"
            stroke="#f87171"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
