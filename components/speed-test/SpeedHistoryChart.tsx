"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

interface Row {
  created_at: string;
  download: number;
  upload: number;
}

function formatTime(value: string): string {
  const m = value.match(/T?(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : value;
}

export default function SpeedHistoryChart({ data }: { data: Row[] }) {
  const points = [...data]
    .reverse()
    .map((r) => ({
      time: formatTime(r.created_at),
      download: Math.round(r.download * 10) / 10,
      upload: Math.round(r.upload * 10) / 10,
    }));

  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} />
          <YAxis stroke="#94a3b8" fontSize={11} unit=" Mbps" />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey="download"
            name="Download"
            stroke="#38bdf8"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="upload"
            name="Upload"
            stroke="#4ade80"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
