"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Series = { dates: string[]; players: { id: number; name: string; points: number[] }[] };

// One line per place. Amber belongs to the leader alone (the honour); the chasers use quieter
// hues from the palette, and each also gets its own dash so colour is never the only way to tell lines apart.
const LINES = [
  { stroke: "var(--color-season-amber)", dash: undefined, width: 3 },
  { stroke: "var(--color-season-ink)", dash: undefined, width: 2 },
  { stroke: "#5fb3ad", dash: "6 3", width: 2 },
  { stroke: "var(--color-season-muted)", dash: "2 3", width: 2 },
  { stroke: "color-mix(in oklab, var(--color-season-ink) 55%, transparent)", dash: "8 3 2 3", width: 2 },
];

const short = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** The top players' points building up through the season, one line each. */
export default function RaceChart({ series }: { series: Series }) {
  if (series.dates.length < 2) {
    return <p className="py-16 text-center text-[0.9375rem] text-season-muted">The race chart appears once a few events have been played.</p>;
  }
  const data = series.dates.map((d, i) => {
    const row: Record<string, number | string> = { date: d };
    for (const p of series.players) row[`p${p.id}`] = p.points[i];
    return row;
  });

  // A text version for screen readers: what the chart shows and where each line ends up.
  const last = series.dates.length - 1;
  const summary =
    `Line chart of points through the season, from ${short(series.dates[0])} to ${short(series.dates[last])}. Latest totals: ` +
    series.players.map((p) => `${p.name} ${Number(p.points[last] ?? 0).toFixed(2)}`).join(", ") +
    ".";

  return (
    <div className="h-72 w-full" role="img" aria-label={summary}>
      {/* initialDimension avoids Recharts measuring a -1 size before layout. */}
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 288 }}>
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-season-ink)" strokeOpacity={0.08} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={short}
            minTickGap={40}
            tick={{ fill: "var(--color-season-muted)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis width={44} tick={{ fill: "var(--color-season-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-season-night)",
              border: "1px solid rgb(255 255 255 / 0.12)",
              borderRadius: "3px",
              color: "var(--color-season-ink)",
            }}
            itemStyle={{ fontSize: "0.875rem" }}
            labelStyle={{ color: "var(--color-season-muted)", fontSize: "0.8125rem", marginBottom: "4px" }}
            labelFormatter={(d) => new Date(String(d)).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            formatter={(value: number, key: string) => {
              const p = series.players.find((x) => `p${x.id}` === key);
              return [`${Number(value).toFixed(2)} pts`, p?.name ?? ""];
            }}
            itemSorter={(item) => -Number(item.value)}
          />
          <Legend
            iconType="plainline"
            itemSorter={null} // keep rank order: leader first
            wrapperStyle={{ fontSize: 13, paddingTop: 10, color: "var(--color-season-ink)" }}
            formatter={(key: string) => series.players.find((x) => `p${x.id}` === key)?.name ?? key}
          />
          {series.players.map((p, i) => (
            <Line
              key={p.id}
              type="stepAfter"
              dataKey={`p${p.id}`}
              stroke={LINES[i % LINES.length].stroke}
              strokeDasharray={LINES[i % LINES.length].dash}
              strokeWidth={LINES[i % LINES.length].width}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
