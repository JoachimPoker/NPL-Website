"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Point = { date: string; points: number; event: string };

/** NPL points building up over the season, one step per cash. */
export default function SeasonPointsChart({ data, empty = "The chart appears after a couple of cashes this season." }: { data: Point[]; empty?: string }) {
  if (!data || data.length < 2) {
    return (
      <div className="flex h-56 items-center justify-center">
        <span className="text-[0.9375rem] text-season-muted">{empty}</span>
      </div>
    );
  }

  // Over more than one year, ticks carry the year ("Oct 24") so the axis reads in order.
  const manyYears = new Date(data[0].date).getFullYear() !== new Date(data[data.length - 1].date).getFullYear();

  // A text version for screen readers: the span and where the total ends up.
  const last = data[data.length - 1];
  const fmt = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const summary = `Line chart of points building up, cash by cash, from ${fmt(data[0].date)} to ${fmt(last.date)}: ${data.length} results, ending on ${Number(last.points).toFixed(2)} points.`;

  return (
    <div className="h-64 w-full" role="img" aria-label={summary}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="seasonPointsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-season-amber)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--color-season-amber)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-season-ink)" strokeOpacity={0.08} vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: "var(--color-season-muted)", fontSize: 12 }}
            tickFormatter={(d) => new Date(d).toLocaleDateString("en-GB", manyYears ? { month: "short", year: "2-digit" } : { day: "numeric", month: "short" })}
            minTickGap={40}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            width={40}
            tick={{ fill: "var(--color-season-muted)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-season-night)",
              border: "1px solid rgb(255 255 255 / 0.12)",
              borderRadius: "3px",
              maxWidth: 260,
            }}
            itemStyle={{ color: "var(--color-season-ink)", fontSize: "13px" }}
            labelStyle={{ color: "var(--color-season-muted)", fontSize: "12px", marginBottom: "4px", whiteSpace: "normal" }}
            formatter={(value: number) => [`${Number(value).toFixed(2)} pts`, "Season total"]}
            labelFormatter={(label, payload) =>
              `${new Date(label).toLocaleDateString("en-GB")} · ${payload?.[0]?.payload?.event ?? ""}`
            }
          />
          <Area
            type="stepAfter"
            dataKey="points"
            stroke="var(--color-season-amber)"
            strokeWidth={2.5}
            fill="url(#seasonPointsFill)"
            dot={false}
            activeDot={{ r: 5, stroke: "var(--color-season-night)", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
