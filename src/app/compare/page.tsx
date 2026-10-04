import Link from "next/link";
import { pageMeta } from "@/lib/site";
import { Suspense } from "react";
import { getCareer, headToHead, type Career } from "@/lib/career";
import { TitleBand } from "@/components/tournaments/ComingUp";
import { eventTitle } from "@/components/tournaments/SeasonCalendar";
import { getSiteImages } from "@/lib/siteImages";
import PlayerSearch from "./PlayerSearch";

export const metadata = pageMeta({ title: "Compare players", description: "Put two players side by side: head-to-head record, career numbers and badges.", path: "/compare" });
export const dynamic = "force-dynamic";

const gbp = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;
const ordinal = (n: number) => {
  const t = n % 100;
  return `${n}${t >= 11 && t <= 13 ? "th" : n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th"}`;
};
const h2 = "text-[clamp(1.3125rem,1.6vw,1.6875rem)] font-semibold leading-tight";

export default async function ComparePage(props: { searchParams: Promise<{ a?: string; b?: string }> }) {
  const img = await getSiteImages();
  const sp = await props.searchParams;
  const [a, b] = await Promise.all([
    sp.a ? getCareer(Number(sp.a)) : Promise.resolve(null),
    sp.b ? getCareer(Number(sp.b)) : Promise.resolve(null),
  ]);

  return (
    <div className="bg-season-night font-season text-season-ink">
      {/* The two corners: each side names its player and can be changed in place. */}
      <TitleBand image={img.players_hero} position="object-[72%_45%]">
        <h1 className="sr-only">{a && b ? `${a.player.name} versus ${b.player.name}` : "Compare players"}</h1>
        <div className="grid items-end gap-x-[clamp(1rem,3vw,3rem)] gap-y-6 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <Suspense>
            <Corner career={a} side="a" />
          </Suspense>
          <p aria-hidden="true" className="text-[clamp(1.5rem,2.4vw,2.5rem)] font-semibold text-season-ink/50 md:pb-[4.25rem]">vs</p>
          <Suspense>
            <Corner career={b} side="b" />
          </Suspense>
        </div>
      </TitleBand>

      <div className="px-4 pb-[clamp(2.5rem,4vw,4rem)] sm:px-[3.6vw]">
        {a && b ? (
          <Comparison a={a} b={b} />
        ) : (
          <p className="max-w-[36em] text-[1.0625rem] text-season-ink/80">
            Pick two players to see their career numbers side by side, and who finished higher every time they cashed in the same event.
          </p>
        )}
      </div>
    </div>
  );
}

function Corner({ career, side }: { career: Career; side: "a" | "b" }) {
  const right = side === "b";
  return (
    <div className={`min-w-0 ${right ? "md:text-right" : ""}`}>
      {career ? (
        <Link
          href={`/players/${career.player.id}`}
          className="block text-[clamp(1.75rem,2.8vw,3rem)] font-bold leading-[1.04] tracking-[-0.012em] [overflow-wrap:anywhere] hover:underline hover:decoration-season-ink/40 hover:underline-offset-[0.12em]"
        >
          {career.player.name}
        </Link>
      ) : (
        <p className="text-[clamp(1.75rem,2.8vw,3rem)] font-bold leading-[1.04] tracking-[-0.012em] text-season-ink/35">Player {side === "a" ? "one" : "two"}</p>
      )}
      <div className={`mt-4 max-w-[24rem] ${right ? "md:ml-auto" : ""}`}>
        <PlayerSearch side={side} label={career ? "Change player" : "Find a player"} />
      </div>
    </div>
  );
}

/** One line of the tale of the tape: the figure on each side, with a bar out from the middle; the better side is amber. */
function TapeRow({ label, a, b, fmt = (n) => n.toLocaleString("en-GB"), quiet = false }: { label: string; a: number; b: number; fmt?: (n: number) => string; quiet?: boolean }) {
  const max = Math.max(a, b, 1);
  const aWins = a > b, bWins = b > a;
  const bar = (wins: boolean) => (wins ? "bg-season-amber" : "bg-season-ink/25");
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(6.5rem,auto)_minmax(0,1fr)] items-center gap-x-3 border-b border-white/[0.07] py-3.5 sm:gap-x-6">
      <div className="flex items-center justify-end gap-3">
        <span className={`tabular-nums ${quiet ? "text-[1.0625rem]" : "text-[clamp(1.125rem,1.6vw,1.5rem)]"} font-semibold ${aWins ? "text-season-amber" : "text-season-ink/75"}`}>{fmt(a)}</span>
        <span aria-hidden="true" className="hidden h-2 w-[clamp(4rem,14vw,14rem)] justify-end overflow-hidden rounded-full bg-white/[0.06] sm:flex">
          <span className={`h-full rounded-full ${bar(aWins)}`} style={{ width: `${(a / max) * 100}%` }} />
        </span>
      </div>
      <span className="text-center text-[0.9375rem] text-season-muted">{label}</span>
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="hidden h-2 w-[clamp(4rem,14vw,14rem)] overflow-hidden rounded-full bg-white/[0.06] sm:flex">
          <span className={`h-full rounded-full ${bar(bWins)}`} style={{ width: `${(b / max) * 100}%` }} />
        </span>
        <span className={`tabular-nums ${quiet ? "text-[1.0625rem]" : "text-[clamp(1.125rem,1.6vw,1.5rem)]"} font-semibold ${bWins ? "text-season-amber" : "text-season-ink/75"}`}>{fmt(b)}</span>
      </div>
    </div>
  );
}

function Comparison({ a, b }: { a: NonNullable<Career>; b: NonNullable<Career> }) {
  const h2h = headToHead(a.results, b.results);
  const years = [...new Set([...a.seasons, ...b.seasons].map((s) => s.year))].sort((x, y) => y - x);
  const leader = h2h.aAhead > h2h.bAhead ? a.player.name : h2h.bAhead > h2h.aAhead ? b.player.name : null;

  return (
    <div className="space-y-[clamp(3rem,5vw,5rem)]">
      {/* Head to head: the score first, because it's the question people come with */}
      <section aria-labelledby="h2h">
        <h2 id="h2h" className={h2}>Head to head</h2>
        <p className="mt-1 text-[0.9375rem] text-season-muted">Every event they both cashed in: who finished higher?</p>
        {h2h.shared.length === 0 ? (
          <p className="mt-5 border-t border-white/[0.12] pt-5 text-[1.0625rem] text-season-ink/80">They haven&apos;t cashed in the same event yet.</p>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-[clamp(1rem,3vw,3rem)] border border-white/[0.08] bg-[linear-gradient(180deg,#14434a_0%,#0f3337_60%)] px-5 py-6 sm:px-8">
              <p className="min-w-0 text-right">
                <span className="block truncate text-[1rem] text-season-ink/80">{a.player.name}</span>
                <span className={`block text-[clamp(2.75rem,5vw,4.5rem)] font-bold leading-none tabular-nums ${h2h.aAhead > h2h.bAhead ? "text-season-amber" : ""}`}>{h2h.aAhead}</span>
              </p>
              <p className="text-center text-[0.9375rem] text-season-muted">
                <span className="block text-[1.5rem] text-season-ink/40" aria-hidden="true">–</span>
                {h2h.shared.length} shared {h2h.shared.length === 1 ? "cash" : "cashes"}
              </p>
              <p className="min-w-0">
                <span className="block truncate text-[1rem] text-season-ink/80">{b.player.name}</span>
                <span className={`block text-[clamp(2.75rem,5vw,4.5rem)] font-bold leading-none tabular-nums ${h2h.bAhead > h2h.aAhead ? "text-season-amber" : ""}`}>{h2h.bAhead}</span>
              </p>
            </div>
            <p className="sr-only">
              {leader ? `${leader} leads ${Math.max(h2h.aAhead, h2h.bAhead)} to ${Math.min(h2h.aAhead, h2h.bAhead)}` : `Level at ${h2h.aAhead} each`} in {h2h.shared.length} shared cashes.
            </p>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full border-collapse text-left tabular-nums">
                <thead>
                  <tr className="border-b border-white/[0.12] text-[0.875rem] text-season-muted">
                    <th scope="col" className="hidden pb-3 pr-5 font-medium sm:table-cell">Date</th>
                    <th scope="col" className="w-full pb-3 font-medium">Event</th>
                    <th scope="col" className="max-w-[9rem] truncate pb-3 pl-4 text-right font-medium">{a.player.name}</th>
                    <th scope="col" className="max-w-[9rem] truncate pb-3 pl-4 text-right font-medium">{b.player.name}</th>
                  </tr>
                </thead>
                <tbody>
                  {h2h.shared.slice(0, 30).map(({ a: ra, b: rb }) => {
                    const aBetter = (ra.position ?? Infinity) < (rb.position ?? Infinity);
                    const bBetter = (rb.position ?? Infinity) < (ra.position ?? Infinity);
                    return (
                      <tr key={ra.event_id} className="border-b border-white/[0.07]">
                        <td className="hidden whitespace-nowrap py-3 pr-5 text-[0.9375rem] text-season-muted sm:table-cell">
                          {ra.date ? new Date(ra.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "–"}
                        </td>
                        <td className="max-w-0 py-3">
                          <Link href={`/events/e/${ra.event_id}`} className="block truncate decoration-season-ink/40 underline-offset-4 hover:underline" title={ra.event_name}>{eventTitle(ra.event_name)}</Link>
                        </td>
                        <td className={`whitespace-nowrap pl-4 text-right font-semibold ${aBetter ? "text-season-amber" : "text-season-ink/60"}`}>{ra.position ? ordinal(ra.position) : "–"}</td>
                        <td className={`whitespace-nowrap pl-4 text-right font-semibold ${bBetter ? "text-season-amber" : "text-season-ink/60"}`}>{rb.position ? ordinal(rb.position) : "–"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {h2h.shared.length > 30 && <p className="mt-3 text-[0.875rem] text-season-muted">Showing the 30 most recent of {h2h.shared.length}.</p>}
          </>
        )}
      </section>

      {/* The tale of the tape */}
      <section aria-labelledby="tape">
        <h2 id="tape" className={h2}>Career, side by side</h2>
        <p className="mt-1 text-[0.9375rem] text-season-muted">Every season added up; the better figure is in amber.</p>
        <div className="mt-5 border-t border-white/[0.12]">
          <TapeRow label="Points" a={a.totals.points} b={b.totals.points} fmt={(n) => n.toFixed(0)} />
          <TapeRow label="Cashes" a={a.totals.cashes} b={b.totals.cashes} />
          <TapeRow label="Wins" a={a.totals.wins} b={b.totals.wins} />
          <TapeRow label="Final tables" a={a.totals.final_tables} b={b.totals.final_tables} />
          <TapeRow label="Badges" a={a.totals.badges} b={b.totals.badges} />
          <TapeRow label="Winnings" a={a.totals.money} b={b.totals.money} fmt={gbp} quiet />
          <TapeRow label="Biggest cash" a={a.totals.best_cash?.prize ?? 0} b={b.totals.best_cash?.prize ?? 0} fmt={gbp} quiet />
        </div>
      </section>

      {years.length > 0 && (
        <section aria-labelledby="seasons-vs">
          <h2 id="seasons-vs" className={h2}>NPL finishes by season</h2>
          <div className="mt-5 border-t border-white/[0.12]">
            {years.map((y) => {
              const sa = a.seasons.find((s) => s.year === y)?.leagues.npl;
              const sb = b.seasons.find((s) => s.year === y)?.leagues.npl;
              const aBetter = sa && (!sb || sa.position < sb.position);
              const bBetter = sb && (!sa || sb.position < sa.position);
              return (
                <div key={y} className="grid grid-cols-[minmax(0,1fr)_minmax(6.5rem,auto)_minmax(0,1fr)] items-center gap-x-3 border-b border-white/[0.07] py-3.5 sm:gap-x-6">
                  <span className={`text-right text-[clamp(1.125rem,1.6vw,1.5rem)] font-semibold tabular-nums ${aBetter ? "text-season-amber" : "text-season-ink/60"}`}>{sa ? ordinal(sa.position) : "–"}</span>
                  <span className="text-center text-[0.9375rem] tabular-nums text-season-muted">{y}</span>
                  <span className={`text-[clamp(1.125rem,1.6vw,1.5rem)] font-semibold tabular-nums ${bBetter ? "text-season-amber" : "text-season-ink/60"}`}>{sb ? ordinal(sb.position) : "–"}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
