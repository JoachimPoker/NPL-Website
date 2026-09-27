"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Point = { date: string; points: number; event: string };

/** NPL points building up over the season, one step per cash. */
export default function SeasonPointsChart({ data }: { data: Point[] }) {
  if (!data || data.length < 2) {
    return (
      <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-base-content/10">
        <span className="text-sm text-base-content/45">The chart appears after a couple of cashes this season.</span>
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="seasonPointsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-base-content)" strokeOpacity={0.07} vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: "var(--color-base-content)", fillOpacity: 0.45, fontSize: 11 }}
            tickFormatter={(d) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            minTickGap={40}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            width={40}
            tick={{ fill: "var(--color-base-content)", fillOpacity: 0.45, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-base-300)",
              border: "1px solid color-mix(in oklab, var(--color-base-content) 12%, transparent)",
              borderRadius: "10px",
              maxWidth: 260,
            }}
            itemStyle={{ color: "var(--color-base-content)", fontSize: "12px" }}
            labelStyle={{ color: "var(--color-base-content)", opacity: 0.55, fontSize: "11px", marginBottom: "4px", whiteSpace: "normal" }}
            formatter={(value: number) => [`${Number(value).toFixed(2)} pts`, "Season total"]}
            labelFormatter={(label, payload) =>
              `${new Date(label).toLocaleDateString("en-GB")} · ${payload?.[0]?.payload?.event ?? ""}`
            }
          />
          <Area
            type="stepAfter"
            dataKey="points"
            stroke="var(--color-primary)"
            strokeWidth={2.5}
            fill="url(#seasonPointsFill)"
            dot={false}
            activeDot={{ r: 5, stroke: "var(--color-base-100)", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
