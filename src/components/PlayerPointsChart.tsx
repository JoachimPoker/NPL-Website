"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

type DataPoint = {
  date: string;
  points: number;
  rank: number;
};

export default function PlayerPointsChart({ data }: { data: DataPoint[] }) {
  if (!data || data.length < 2) {
    return (
      <div className="h-64 flex items-center justify-center rounded-xl border border-dashed border-base-content/10">
        <span className="text-sm text-base-content/45">Not enough results yet to chart rank movement.</span>
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-base-content)" strokeOpacity={0.07} vertical={false} />
          <XAxis 
            dataKey="date" 
            tick={{ fill: 'var(--color-base-content)', fillOpacity: 0.45, fontSize: 11, fontFamily: 'var(--font-numbers)' }} 
            tickFormatter={(str) => {
              const d = new Date(str);
              return `${d.getDate()}/${d.getMonth()+1}`;
            }}
            minTickGap={30}
            axisLine={false}
            tickLine={false}
          />
          {/* Reversed Y-Axis: Rank 1 is at the TOP */}
          <YAxis 
            hide 
            reversed={true} 
            domain={[1, 'auto']} 
            padding={{ top: 20, bottom: 20 }}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: 'var(--color-base-300)', border: '1px solid color-mix(in oklab, var(--color-base-content) 12%, transparent)', borderRadius: '10px' }}
            itemStyle={{ color: 'var(--color-base-content)', fontSize: '12px', fontFamily: 'var(--font-numbers)' }}
            labelStyle={{ color: 'var(--color-base-content)', opacity: 0.5, fontSize: '11px', marginBottom: '4px' }}
            formatter={(value: number) => [`#${value}`, "Rank"]}
            labelFormatter={(label) => new Date(label).toLocaleDateString("en-GB")}
          />
          <Line 
            type="monotone" 
            dataKey="rank" 
            stroke="var(--color-primary)"
            strokeWidth={2.5}
            dot={{ fill: 'var(--color-primary)', r: 3, strokeWidth: 0 }} 
            activeDot={{ r: 6, stroke: 'var(--color-base-100)', strokeWidth: 2 }} 
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}