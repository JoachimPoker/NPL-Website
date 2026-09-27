import Link from "next/link";
import { pageMeta } from "@/lib/site";
import { Suspense } from "react";
import { Swords } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Initial } from "@/components/HomeLeaderboard";
import { getCareer, headToHead, type Career } from "@/lib/career";
import PlayerSearch from "./PlayerSearch";

export const metadata = pageMeta({ title: "Compare players", description: "Put two players side by side: head-to-head record, career numbers and badges.", path: "/compare" });
export const dynamic = "force-dynamic";

const gbp = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;

export default async function ComparePage(props: { searchParams: Promise<{ a?: string; b?: string }> }) {
  const sp = await props.searchParams;
  const [a, b] = await Promise.all([
    sp.a ? getCareer(Number(sp.a)) : Promise.resolve(null),
    sp.b ? getCareer(Number(sp.b)) : Promise.resolve(null),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Head to head"
        title={a && b ? <>{a.player.name} <span className="text-base-content/35">vs</span> {b.player.name}</> : "Compare players"}
        description="Career numbers side by side, and who came out on top when they cashed in the same event."
      />

      <div className="mx-auto w-full max-w-7xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-2">
          <Suspense>
            <Picker career={a} side="a" />
            <Picker career={b} side="b" />
          </Suspense>
        </div>

        {a && b ? <Comparison a={a} b={b} /> : (
          <p className="panel px-6 py-12 text-center text-base-content/55">Pick two players to compare.</p>
        )}
      </div>
    </>
  );
}

function Picker({ career, side }: { career: Career; side: "a" | "b" }) {
  return (
    <div className="panel space-y-3 p-5">
      {career ? (
        <Link href={`/players/${career.player.id}`} className="group flex items-center gap-3">
          <Initial name={career.player.name} />
          <span className="font-display text-xl font-semibold transition-colors group-hover:text-primary">{career.player.name}</span>
        </Link>
      ) : (
        <div className="font-display text-xl text-base-content/40">Player {side === "a" ? "one" : "two"}</div>
      )}
      <PlayerSearch side={side} label={career ? "Change player…" : "Search a player…"} />
    </div>
  );
}

function Comparison({ a, b }: { a: NonNullable<Career>; b: NonNullable<Career> }) {
  const h2h = headToHead(a.results, b.results);
  const rows: { label: string; a: number; b: number; fmt?: (n: number) => string; lowerIsBetter?: boolean }[] = [
    { label: "Career points", a: a.totals.points, b: b.totals.points, fmt: (n) => n.toFixed(0) },
    { label: "Cashes", a: a.totals.cashes, b: b.totals.cashes },
    { label: "Wins", a: a.totals.wins, b: b.totals.wins },
    { label: "Final tables", a: a.totals.final_tables, b: b.totals.final_tables },
    { label: "Winnings", a: a.totals.money, b: b.totals.money, fmt: gbp },
    { label: "Biggest cash", a: a.totals.best_cash?.prize ?? 0, b: b.totals.best_cash?.prize ?? 0, fmt: gbp },
    { label: "Badges", a: a.totals.badges, b: b.totals.badges },
  ];
  const years = [...new Set([...a.seasons, ...b.seasons].map((s) => s.year))].sort((x, y) => y - x);

  return (
    <>
      <section className="panel overflow-hidden" aria-label="Career comparison">
        <table className="table w-full">
          <thead>
            <tr>
              <th className="w-1/3 pl-6 text-right">{a.player.name}</th>
              <th className="text-center" />
              <th className="w-1/3 pr-6">{b.player.name}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const fmt = r.fmt ?? ((n: number) => n.toLocaleString("en-GB"));
              const aWins = r.a > r.b, bWins = r.b > r.a;
              return (
                <tr key={r.label}>
                  <td className={`pl-6 text-right font-mono text-lg ${aWins ? "font-semibold text-primary" : "text-base-content/60"}`}>{fmt(r.a)}</td>
                  <td className="text-center text-xs uppercase tracking-wider text-base-content/45">{r.label}</td>
                  <td className={`pr-6 font-mono text-lg ${bWins ? "font-semibold text-primary" : "text-base-content/60"}`}>{fmt(r.b)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {years.length > 0 && (
        <section className="panel overflow-hidden" aria-labelledby="seasons-vs">
          <h2 id="seasons-vs" className="border-b border-base-content/[0.07] px-6 py-5 font-display text-lg font-semibold">NPL finishes by season</h2>
          <table className="table w-full">
            <tbody>
              {years.map((y) => {
                const sa = a.seasons.find((s) => s.year === y)?.leagues.npl;
                const sb = b.seasons.find((s) => s.year === y)?.leagues.npl;
                const aBetter = sa && (!sb || sa.position < sb.position);
                const bBetter = sb && (!sa || sb.position < sa.position);
                return (
                  <tr key={y}>
                    <td className={`w-1/3 pl-6 text-right font-mono ${aBetter ? "font-semibold text-primary" : "text-base-content/60"}`}>{sa ? `#${sa.position}` : "–"}</td>
                    <td className="text-center text-sm text-base-content/55">{y}</td>
                    <td className={`w-1/3 pr-6 font-mono ${bBetter ? "font-semibold text-primary" : "text-base-content/60"}`}>{sb ? `#${sb.position}` : "–"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      <section className="panel overflow-hidden" aria-labelledby="h2h">
        <div className="flex flex-col gap-2 border-b border-base-content/[0.07] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="h2h" className="flex items-center gap-2 font-display text-lg font-semibold">
            <Swords size={18} className="text-primary" aria-hidden="true" /> Same event, who finished higher?
          </h2>
          {h2h.shared.length > 0 && (
            <div className="font-mono text-sm">
              <span className={h2h.aAhead > h2h.bAhead ? "font-semibold text-primary" : ""}>{h2h.aAhead}</span>
              <span className="mx-2 text-base-content/40">–</span>
              <span className={h2h.bAhead > h2h.aAhead ? "font-semibold text-primary" : ""}>{h2h.bAhead}</span>
              <span className="ml-2 text-base-content/45">in {h2h.shared.length} shared cash{h2h.shared.length === 1 ? "" : "es"}</span>
            </div>
          )}
        </div>
        {h2h.shared.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-base-content/50">They haven&apos;t cashed in the same event yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm w-full">
              <thead>
                <tr><th className="pl-6">Date</th><th>Event</th><th className="text-right">{a.player.name}</th><th className="pr-6 text-right">{b.player.name}</th></tr>
              </thead>
              <tbody>
                {h2h.shared.slice(0, 30).map(({ a: ra, b: rb }) => {
                  const aBetter = (ra.position ?? Infinity) < (rb.position ?? Infinity);
                  return (
                    <tr key={ra.event_id}>
                      <td className="whitespace-nowrap pl-6 font-mono text-xs text-base-content/45">
                        {ra.date ? new Date(ra.date).toLocaleDateString("en-GB") : "–"}
                      </td>
                      <td><Link href={`/events/e/${ra.event_id}`} className="hover:text-primary">{ra.event_name}</Link></td>
                      <td className={`text-right font-mono ${aBetter ? "font-semibold text-primary" : "text-base-content/60"}`}>#{ra.position ?? "–"}</td>
                      <td className={`pr-6 text-right font-mono ${!aBetter ? "font-semibold text-primary" : "text-base-content/60"}`}>#{rb.position ?? "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
