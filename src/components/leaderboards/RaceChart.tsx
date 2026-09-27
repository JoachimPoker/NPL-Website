"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Series = { dates: string[]; players: { id: number; name: string; points: number[] }[] };

// One colour per place: gold for the leader, then clearly different hues.
const COLOURS = ["#d59516", "#7aa2ff", "#49b170", "#e05d8c", "#b39ddb"];

const short = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** The top players' points building up through the season, one line each. */
export default function RaceChart({ series }: { series: Series }) {
  if (series.dates.length < 2) {
    return <p className="py-16 text-center text-sm text-base-content/45">The race chart appears once a few events have been played.</p>;
  }
  const data = series.dates.map((d, i) => {
    const row: Record<string, number | string> = { date: d };
    for (const p of series.players) row[`p${p.id}`] = p.points[i];
    return row;
  });

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-base-content)" strokeOpacity={0.07} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={short}
            minTickGap={40}
            tick={{ fill: "var(--color-base-content)", fillOpacity: 0.45, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis width={44} tick={{ fill: "var(--color-base-content)", fillOpacity: 0.45, fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-base-300)",
              border: "1px solid color-mix(in oklab, var(--color-base-content) 12%, transparent)",
              borderRadius: "10px",
            }}
            itemStyle={{ fontSize: "12px" }}
            labelStyle={{ color: "var(--color-base-content)", opacity: 0.55, fontSize: "11px", marginBottom: "4px" }}
            labelFormatter={(d) => new Date(String(d)).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            formatter={(value: number, key: string) => {
              const p = series.players.find((x) => `p${x.id}` === key);
              return [`${Number(value).toFixed(2)} pts`, p?.name ?? ""];
            }}
            itemSorter={(item) => -Number(item.value)}
          />
          <Legend
            iconType="plainline"
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            formatter={(key: string) => series.players.find((x) => `p${x.id}` === key)?.name ?? key}
          />
          {series.players.map((p, i) => (
            <Line
              key={p.id}
              type="stepAfter"
              dataKey={`p${p.id}`}
              stroke={COLOURS[i % COLOURS.length]}
              strokeWidth={i === 0 ? 3 : 2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
