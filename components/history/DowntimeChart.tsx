"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface Day {
  date: string;
  downCount: number;
  downMinutes: number;
}

export default function DowntimeChart({ data }: { data: Day[] }) {
  const points = data.map((d) => ({
    day: d.date.slice(5), // MM-DD
    minutes: d.downMinutes,
    count: d.downCount,
  }));

  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} />
          <YAxis stroke="#94a3b8" fontSize={11} unit="m" />
          <Tooltip />
          <Bar
            dataKey="minutes"
            name="Downtime (menit)"
            fill="#f87171"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
