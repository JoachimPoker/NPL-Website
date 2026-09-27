import Link from "next/link";
import { ArrowLeft, Swords, Trophy } from "lucide-react";
import type { Metadata } from "next";
import { getPlayerProfile } from "@/lib/data";
import { getCareer } from "@/lib/career";
import { pageMeta } from "@/lib/site";
import ShareButton from "@/components/ShareButton";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import SeasonPointsChart from "@/components/SeasonPointsChart";
import BadgeMedal from "@/components/badges/BadgeMedal";
import { type BadgeDefinition, TIER_LABEL } from "@/lib/badges";

type Title = { def: BadgeDefinition; occasions: { label: string; year: number | null }[] };

/** Titles won, with how often and where: "GUKPT Winner ×2 · GUKPT Luton · Aug 2026". */
function TitleCabinet({ items }: { items: Title[] }) {
  return (
    <ul className="space-y-2 p-4 pt-3">
      {items.map(({ def, occasions }) => (
        <li key={def.key} className="flex items-start gap-3 rounded-lg bg-base-200/50 p-2.5" title={def.description}>
          <BadgeMedal tier="gold" icon={def.icon} imageUrl={def.image_url} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold">{def.name}</span>
              {occasions.length > 1 && (
                <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary">×{occasions.length}</span>
              )}
            </div>
            <div className="mt-0.5 line-clamp-2 text-xs text-base-content/50" title={occasions.map((o) => o.label).filter(Boolean).join(" · ")}>
              {occasions.slice(0, 2).map((o) => o.label).filter(Boolean).join(" · ")}
              {occasions.length > 2 && ` · +${occasions.length - 2} more`}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

type Achievement = {
  type: string; title: string; unit: (n: number) => string; current: number;
  level: BadgeDefinition | null; next: BadgeDefinition | null; target: number | null; levels: number; reachedCount: number;
};

/** Every achievement ladder: current level, and progress to the next one. */
function AchievementGrid({ items }: { items: Achievement[] }) {
  return (
    <ul className="space-y-4 p-6 pt-4">
      {items.map((a) => {
        const shown = a.level ?? a.next;
        const pct = a.target ? Math.min(100, Math.round((a.current / a.target) * 100)) : 100;
        return (
          <li key={a.type} className="flex items-center gap-3">
            {shown && <BadgeMedal tier={shown.tier} icon={shown.icon} imageUrl={shown.image_url} size="sm" locked={!a.level} />}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-semibold">{a.title}</span>
                <span className="shrink-0 text-[11px] text-base-content/45">
                  {a.level ? `${TIER_LABEL[a.level.tier]} · ` : ""}level {a.reachedCount}/{a.levels}
                </span>
              </div>
              <div
                className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-base-content/[0.08]"
                role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${a.title} progress`}
              >
                <div className={`h-full rounded-full ${a.next ? "bg-primary" : "bg-success"}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-1 text-[11px] text-base-content/50">
                {a.next && a.target != null
                  ? `${a.unit(Math.round(a.current)).replace(/ in one go$/, "")} · next: ${a.next.name} at ${a.unit(a.target)}`
                  : `Top level reached: ${a.level?.name}`}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** "Robert Douras" → "RD", "T. H." → "TH". */
const monogram = (name: string) =>
  name.split(/[\s.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";


export const runtime = "nodejs";
export const revalidate = 60;

export async function generateMetadata(props: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const id = (await props.params).id;
  const career = await getCareer(Number(id));
  if (!career) return { title: "Player not found", robots: { index: false } };
  const { player, totals, seasons } = career;
  const npl = seasons.find((s) => s.active)?.leagues.npl;
  return pageMeta({
    title: player.name,
    description: [
      npl ? `#${npl.position} in the NPL this season` : null,
      `${totals.cashes} cashes, ${totals.wins} wins and ${totals.final_tables} final tables in the National Poker League`,
    ].filter(Boolean).join(" · "),
    path: `/players/${player.id}`,
    // Players who haven't given GDPR consent are shown by initials only; keep them out of search engines.
    noindex: !player.consent,
  });
}

/** Every title with all its occasions (Achievements tab). */
function TitleList({ items }: { items: Title[] }) {
  return (
    <ul className="grid gap-3 p-6 md:grid-cols-2">
      {items.map(({ def, occasions }) => (
        <li key={def.key} className="flex items-start gap-3 rounded-xl bg-base-200/50 p-4" title={def.description}>
          <BadgeMedal tier="gold" icon={def.icon} imageUrl={def.image_url} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{def.name}</span>
              {occasions.length > 1 && (
                <span className="rounded-full bg-primary/15 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary">×{occasions.length}</span>
              )}
            </div>
            <ul className="mt-1 space-y-0.5 text-xs text-base-content/55">
              {occasions.map((o, i) => <li key={i}>{o.label || def.description}</li>)}
            </ul>
          </div>
        </li>
      ))}
    </ul>
  );
}

type ResultRow = {
  id: number; event_id: number; event_name: string; date: string | null; casino: string | null;
  position: number | null; points: number; prize: number;
};

/** Cashes table, shared by the Overview (last few) and Results (all, filtered) tabs. */
function ResultsTable({ rows }: { rows: ResultRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="table table-sm w-full">
        <thead>
          <tr>
            <th className="py-3 pl-6">Date</th>
            <th className="py-3">Event</th>
            <th className="py-3 text-right">Finish</th>
            <th className="py-3 text-right">Points</th>
            <th className="py-3 pr-6 text-right">Prize</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="transition-colors hover:bg-base-content/[0.03]">
              <td className="whitespace-nowrap py-3 pl-6 font-mono text-xs text-base-content/45">
                {r.date ? new Date(r.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "–"}
              </td>
              <td className="py-3">
                <Link href={`/events/e/${r.event_id}`} className="font-medium transition-colors hover:text-primary">{r.event_name}</Link>
                <div className="text-xs text-base-content/45">{r.casino}</div>
              </td>
              <td className="py-3 text-right">
                {r.position === 1 ? (
                  <span className="inline-flex items-center gap-1 rounded bg-primary/15 px-1.5 py-0.5 font-mono text-xs font-semibold text-primary">
                    <Trophy size={11} aria-hidden="true" /> 1st
                  </span>
                ) : (
                  <span className="font-mono text-xs text-base-content/65">{r.position ? `#${r.position}` : "–"}</span>
                )}
              </td>
              <td className="py-3 text-right font-mono text-sm font-semibold">{r.points.toFixed(2)}</td>
              <td className="py-3 pr-6 text-right font-mono text-xs text-base-content/60">
                {r.prize > 0 ? `£${r.prize.toLocaleString("en-GB")}` : "–"}
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr><td colSpan={5} className="py-12 text-center text-sm text-base-content/45">No results here.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "results", label: "Results" },
  { key: "achievements", label: "Achievements" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export default async function PlayerProfile(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; season?: string; series?: string }>;
}) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const tab: Tab = sp.tab === "results" || sp.tab === "achievements" ? sp.tab : "overview";

  // 1. TRACKING
  const supabase = await createSupabaseServerClient();
  try {
    if (Number.isFinite(Number(id))) await supabase.from("player_searches").insert({ player_id: Number(id) });
  } catch (e) { /* ignore */ }

  // 2. FETCH DATA
  const data = await getPlayerProfile(id);

  if (!data) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <div className="eyebrow">Players</div>
        <h1 className="mt-3 font-display text-3xl font-semibold">Player not found</h1>
        <p className="mt-2 text-base-content/55">This profile doesn&apos;t exist or may have been merged with another.</p>
        <Link href="/players" className="btn btn-ghost btn-sm mt-6">Back to players</Link>
      </div>
    );
  }

  const { player: p, stats, season_progress, titles, achievements, seasons, best_results, all_results, series_names } = data;
  const base = `/players/${p.id}`;
  const totalTitles = titles.reduce((n, t) => n + t.occasions.length, 0);
  // Achievements ranked: highest level first, then closest to the next level.
  const rankedAchievements = [...achievements].sort(
    (x, y) =>
      y.reachedCount - x.reachedCount ||
      (y.target ? y.current / y.target : 1) - (x.target ? x.current / x.target : 1)
  );
  const winRate = stats.results_count ? ((stats.total_wins / stats.results_count) * 100).toFixed(1) : "0.0";

  // Results tab filters: season (year) and series (id), only ones this player has cashed in.
  const yearBySeason = new Map(seasons.map((s) => [s.season_id, s.year]));
  const seasonYears = [...new Set(seasons.map((s) => s.year))].sort((a, b) => b - a);
  const playerSeries = [...new Set(all_results.map((r) => r.series_id).filter((x): x is number => !!x))]
    .map((sid) => ({ id: sid, name: series_names.get(sid) ?? "Other" }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const seasonFilter = sp.season ? Number(sp.season) : null;
  const seriesFilter = sp.series ? Number(sp.series) : null;
  const filtered = all_results.filter(
    (r) =>
      (!seasonFilter || (r.season_id != null && yearBySeason.get(r.season_id) === seasonFilter)) &&
      (!seriesFilter || r.series_id === seriesFilter)
  );
  const filterHref = (season: number | null, series: number | null) => {
    const q = new URLSearchParams({ tab: "results" });
    if (season) q.set("season", String(season));
    if (series) q.set("series", String(series));
    return `${base}?${q}`;
  };
  const chip = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors ${
      active ? "bg-primary text-primary-content ring-primary" : "ring-base-content/15 text-base-content/70 hover:text-base-content"
    }`;

  return (
    <>
      {/* --- HEADER --- */}
      <div className="relative overflow-hidden border-b border-base-content/[0.07]">
        <div className="felt-glow pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-10 sm:px-6 md:pt-14 lg:px-8">
          <Link href="/players" className="eyebrow inline-flex items-center gap-1.5 hover:text-primary">
            <ArrowLeft size={13} aria-hidden="true" /> Players
          </Link>

          <div className="mt-6 flex flex-col gap-8 md:flex-row md:items-end">
            <div className="rise flex items-end gap-5">
              <div className="relative shrink-0">
                <div className="h-24 w-24 overflow-hidden rounded-2xl bg-base-300 ring-1 ring-base-content/10 md:h-32 md:w-32">
                  {p.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.avatar_url} alt={`Photo of ${p.name}`} className="h-full w-full object-cover" />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/25 via-primary/10 to-transparent font-display text-4xl font-bold tracking-tight text-primary md:text-5xl"
                    >
                      {monogram(p.name)}
                    </div>
                  )}
                </div>
                {stats.current_rank && stats.current_rank <= 3 && (
                  <span className="absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full bg-primary font-mono text-sm font-bold text-primary-content ring-4 ring-base-200">
                    {stats.current_rank}
                  </span>
                )}
              </div>
              <div className="min-w-0 space-y-3 pb-1">
                <h1 className="font-display text-4xl font-semibold leading-none tracking-[-0.03em] md:text-6xl">{p.name}</h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className={stats.current_rank ? "font-medium text-primary" : "text-base-content/45"}>
                    {stats.current_rank ? `Ranked #${stats.current_rank}` : "Unranked"}
                  </span>
                </div>
              </div>
            </div>

            <dl className="rise grid grid-cols-2 gap-x-10 gap-y-4 md:ml-auto md:text-right [animation-delay:80ms]">
              <div>
                <dt className="eyebrow">Career points</dt>
                <dd className="mt-1 font-display text-3xl font-semibold tabular-nums text-primary">{Math.round(stats.lifetime_points).toLocaleString("en-GB")}</dd>
              </div>
              <div>
                <dt className="eyebrow">Winnings</dt>
                <dd className="mt-1 font-display text-3xl font-semibold tabular-nums">£{Math.round(stats.total_earnings).toLocaleString("en-GB")}</dd>
              </div>
              <div className="col-span-2 flex flex-wrap gap-2">
                <Link href={`/compare?a=${p.id}`} className="btn btn-outline btn-sm gap-2">
                  <Swords size={14} aria-hidden="true" /> Compare with another player
                </Link>
                <ShareButton title={`${p.name} · National Poker League`} />
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* --- TABS --- */}
      <div className="border-b border-base-content/[0.07]">
        <nav aria-label="Player sections" className="mx-auto flex max-w-7xl gap-6 overflow-x-auto px-4 sm:px-6 lg:px-8">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={t.key === "overview" ? base : `${base}?tab=${t.key}`}
              scroll={false}
              aria-current={tab === t.key ? "page" : undefined}
              className={`relative whitespace-nowrap py-4 text-sm font-semibold uppercase tracking-wide transition-colors ${
                tab === t.key ? "text-base-content" : "text-base-content/55 hover:text-base-content"
              }`}
            >
              {t.label}
              {t.key === "results" && <span className="ml-1.5 font-mono text-xs text-base-content/40">{all_results.length}</span>}
              {t.key === "achievements" && totalTitles > 0 && <span className="ml-1.5 font-mono text-xs text-base-content/40">{totalTitles}</span>}
              {tab === t.key && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" />}
            </Link>
          ))}
        </nav>
      </div>

      {/* --- OVERVIEW --- */}
      {tab === "overview" && (
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 py-10 sm:px-6 lg:grid-cols-3 lg:px-8">
          <div className="space-y-6 lg:col-span-2">
            {seasons.length > 0 && (
              <section className="panel overflow-hidden" aria-labelledby="by-season">
                <div className="border-b border-base-content/[0.07] px-6 py-5">
                  <h2 id="by-season" className="font-display text-lg font-semibold">Season by season</h2>
                  <p className="text-sm text-base-content/50">League finishes and results per season</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="table table-sm w-full">
                    <thead>
                      <tr>
                        <th className="py-3 pl-6">Season</th>
                        <th className="py-3 text-right">NPL</th>
                        <th className="py-3 text-right">High Roller</th>
                        <th className="py-3 text-right">Low Roller</th>
                        <th className="py-3 text-right">Cashes</th>
                        <th className="py-3 text-right">Wins</th>
                        <th className="hidden py-3 text-right sm:table-cell">FTs</th>
                        <th className="py-3 pr-6 text-right">Winnings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seasons.map((s) => (
                        <tr key={s.season_id}>
                          <td className="py-3 pl-6 font-medium">
                            {s.year}
                            {s.active && <span className="ml-2 text-xs font-normal text-success">so far</span>}
                          </td>
                          {(["npl", "hrl", "lrl"] as const).map((lg) => {
                            const l = s.leagues[lg];
                            return (
                              <td key={lg} className="py-3 text-right font-mono text-sm">
                                {l ? (
                                  <span className={l.position <= 3 ? "font-semibold text-primary" : ""} title={`${l.points.toFixed(2)} pts`}>
                                    #{l.position}
                                  </span>
                                ) : <span className="text-base-content/30">–</span>}
                              </td>
                            );
                          })}
                          <td className="py-3 text-right font-mono text-sm">{s.cashes}</td>
                          <td className="py-3 text-right font-mono text-sm">{s.wins || "–"}</td>
                          <td className="hidden py-3 text-right font-mono text-sm sm:table-cell">{s.final_tables || "–"}</td>
                          <td className="py-3 pr-6 text-right font-mono text-sm">£{Math.round(s.money).toLocaleString("en-GB")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            <section className="panel" aria-labelledby="trajectory">
              <div className="border-b border-base-content/[0.07] px-6 py-5">
                <h2 id="trajectory" className="font-display text-lg font-semibold">NPL points this season</h2>
                <p className="text-sm text-base-content/50">How the season total built up, cash by cash.</p>
              </div>
              <div className="p-4 md:p-6">
                <SeasonPointsChart data={season_progress} />
              </div>
            </section>

            <section className="panel overflow-hidden" aria-labelledby="recent-cashes">
              <div className="flex items-baseline justify-between border-b border-base-content/[0.07] px-6 py-5">
                <h2 id="recent-cashes" className="font-display text-lg font-semibold">Recent cashes</h2>
                <Link href={`${base}?tab=results`} scroll={false} className="text-sm font-medium text-primary hover:underline">
                  See all {all_results.length} results
                </Link>
              </div>
              <ResultsTable rows={all_results.slice(0, 5)} />
            </section>
          </div>

          <aside className="space-y-6">
            {titles.length > 0 && (
              <section className="panel" aria-labelledby="titles-heading">
                <div className="flex items-baseline justify-between px-6 pt-6">
                  <h2 id="titles-heading" className="eyebrow">Trophy cabinet</h2>
                  <Link href={`${base}?tab=achievements`} scroll={false} className="text-xs text-base-content/45 hover:text-primary">
                    {totalTitles} title{totalTitles === 1 ? "" : "s"}
                  </Link>
                </div>
                <TitleCabinet items={titles.slice(0, 3)} />
                {titles.length > 3 && (
                  <Link href={`${base}?tab=achievements`} scroll={false} className="block border-t border-base-content/[0.07] px-6 py-3 text-xs font-medium text-primary hover:underline">
                    All titles
                  </Link>
                )}
              </section>
            )}

            <section className="panel" aria-labelledby="achievements-heading">
              <div className="flex items-baseline justify-between px-6 pt-6">
                <h2 id="achievements-heading" className="eyebrow">Achievements</h2>
                <span className="text-xs text-base-content/45">{achievements.filter((a) => a.level).length} of {achievements.length} started</span>
              </div>
              <AchievementGrid items={rankedAchievements.slice(0, 3)} />
              <Link href={`${base}?tab=achievements`} scroll={false} className="block border-t border-base-content/[0.07] px-6 py-3 text-xs font-medium text-primary hover:underline">
                All {achievements.length} achievements
              </Link>
            </section>

            {best_results.length > 0 && (
              <section className="panel p-6" aria-labelledby="best-results">
                <h2 id="best-results" className="eyebrow mb-4">Best results</h2>
                <ol className="space-y-3">
                  {best_results.map((r) => (
                    <li key={r.id}>
                      <Link href={`/events/e/${r.event_id}`} className="group block">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="truncate text-sm font-medium transition-colors group-hover:text-primary">{r.event_name}</span>
                          <span className="shrink-0 font-mono text-sm font-semibold">{r.prize ? `£${r.prize.toLocaleString("en-GB")}` : `${r.points.toFixed(1)} pts`}</span>
                        </div>
                        <div className="text-xs text-base-content/45">
                          {r.position === 1 ? "Winner" : r.position ? `#${r.position}` : "–"} · {r.date ? new Date(r.date).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : ""}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            <section className="panel p-6" aria-labelledby="career">
              <h2 id="career" className="eyebrow mb-4">Career</h2>
              <dl className="divide-y divide-base-content/[0.06]">
                {[
                  { label: "Cashes", value: stats.results_count },
                  { label: "Wins", value: stats.total_wins },
                  { label: "Final tables", value: stats.final_tables },
                  { label: "Best finish", value: stats.best_finish ? `#${stats.best_finish}` : "–" },
                  { label: "Win rate (per cash)", value: `${winRate}%` },
                ].map((s) => (
                  <div key={s.label} className="flex items-baseline justify-between py-3 first:pt-0 last:pb-0">
                    <dt className="text-sm text-base-content/60">{s.label}</dt>
                    <dd className="font-mono text-xl font-semibold">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </section>

          </aside>
        </div>
      )}

      {/* --- RESULTS --- */}
      {tab === "results" && (
        <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow mr-1 w-14">Season</span>
              <Link href={filterHref(null, seriesFilter)} scroll={false} className={chip(!seasonFilter)}>All</Link>
              {seasonYears.map((y) => (
                <Link key={y} href={filterHref(y, seriesFilter)} scroll={false} className={chip(seasonFilter === y)}>{y}</Link>
              ))}
            </div>
            {playerSeries.length > 1 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="eyebrow mr-1 w-14">Series</span>
                <Link href={filterHref(seasonFilter, null)} scroll={false} className={chip(!seriesFilter)}>All</Link>
                {playerSeries.map((x) => (
                  <Link key={x.id} href={filterHref(seasonFilter, x.id)} scroll={false} className={chip(seriesFilter === x.id)}>{x.name}</Link>
                ))}
              </div>
            )}
          </div>

          <section className="panel overflow-hidden" aria-labelledby="all-results">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-base-content/[0.07] px-6 py-5">
              <h2 id="all-results" className="font-display text-lg font-semibold">
                {filtered.length} cash{filtered.length === 1 ? "" : "es"}
              </h2>
              <span className="text-sm text-base-content/55">
                {filtered.filter((r) => r.position === 1).length} wins ·{" "}
                £{Math.round(filtered.reduce((n, r) => n + r.prize, 0)).toLocaleString("en-GB")} won ·{" "}
                {filtered.reduce((n, r) => n + r.points, 0).toFixed(2)} points
              </span>
            </div>
            <ResultsTable rows={filtered} />
          </section>
        </div>
      )}

      {/* --- ACHIEVEMENTS --- */}
      {tab === "achievements" && (
        <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
          <section className="panel" aria-labelledby="all-titles">
            <div className="flex items-baseline justify-between border-b border-base-content/[0.07] px-6 py-5">
              <h2 id="all-titles" className="font-display text-lg font-semibold">Trophy cabinet</h2>
              <Link href="/badges" className="text-sm text-base-content/50 hover:text-primary">
                {totalTitles} title{totalTitles === 1 ? "" : "s"} · all badges
              </Link>
            </div>
            {titles.length ? (
              <TitleList items={titles} />
            ) : (
              <p className="px-6 py-8 text-sm text-base-content/50">No titles yet. Win a series Main Event or finish on a league podium to earn one.</p>
            )}
          </section>

          <section className="panel" aria-labelledby="all-achievements">
            <div className="flex items-baseline justify-between border-b border-base-content/[0.07] px-6 py-5">
              <h2 id="all-achievements" className="font-display text-lg font-semibold">Achievements</h2>
              <Link href="/badges?tab=achievements" className="text-sm text-base-content/50 hover:text-primary">
                {achievements.filter((a) => a.level).length} of {achievements.length} started · all levels
              </Link>
            </div>
            <div className="md:[&>ul]:grid md:[&>ul]:grid-cols-2 md:[&>ul]:gap-x-10 md:[&>ul]:gap-y-5 md:[&>ul>li]:!mt-0">
              <AchievementGrid items={rankedAchievements} />
            </div>
          </section>
        </div>
      )}
    </>
  );
}
