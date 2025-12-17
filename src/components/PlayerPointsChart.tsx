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
      <div className="h-64 flex items-center justify-center border border-white/5 rounded-xl bg-base-200/20">
        <span className="text-sm opacity-50 italic">Not enough history to show rank movement.</span>
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
          <XAxis 
            dataKey="date" 
            tick={{ fill: '#ffffff60', fontSize: 10 }} 
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
            contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333', borderRadius: '8px' }}
            itemStyle={{ color: '#fff', fontSize: '12px' }}
            labelStyle={{ color: '#ffffff60', fontSize: '10px', marginBottom: '4px' }}
            formatter={(value: number) => [`#${value}`, "Rank"]}
            labelFormatter={(label) => new Date(label).toLocaleDateString()}
          />
          <Line 
            type="monotone" 
            dataKey="rank" 
            stroke="#dca54c" 
            strokeWidth={3}
            dot={{ fill: '#dca54c', r: 3, strokeWidth: 0 }} 
            activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }} 
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}