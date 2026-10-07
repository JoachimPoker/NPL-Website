import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Lock, Swords, Trophy } from "lucide-react";
import type { Metadata } from "next";
import { getPlayerProfile } from "@/lib/data";
import { getCareer } from "@/lib/career";
import { pageMeta } from "@/lib/site";
import ShareButton from "@/components/ShareButton";
import SeasonPointsChart from "@/components/SeasonPointsChart";
import Medal from "@/components/badges/Medal";
import { LEAGUE_MARKS } from "@/components/home/LeagueLeaders";
import { getSiteImages } from "@/lib/siteImages";
import { type BadgeDefinition, TIER_LABEL } from "@/lib/badges";

type Title = { def: BadgeDefinition; occasions: { label: string; year: number | null }[] };

const LEAGUES = [
  { slug: "npl", label: "National Poker League" },
  { slug: "hrl", label: "High Roller League" },
  { slug: "lrl", label: "Low Roller League" },
] as const;

const pts = (n: number) => Number(n).toFixed(2);
const money = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;
const ordinal = (n: number) => {
  const t = n % 100;
  return `${n}${t >= 11 && t <= 13 ? "th" : n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th"}`;
};
const date = (d: string | null, long = true) =>
  d ? new Date(d).toLocaleDateString("en-GB", long ? { day: "numeric", month: "short", year: "numeric" } : { month: "short", year: "numeric" }) : "–";
/** Event names carry their guarantee ("… - £50,000 GTD"); the money is not the story here. */
const eventTitle = (name: string) => name.split(/\s+[-–]\s+£/)[0].trim();



const card = "border border-white/[0.08] bg-[linear-gradient(180deg,#14434a_0%,#0f3337_60%)]";
const h2 = "text-[clamp(1.3125rem,1.6vw,1.6875rem)] font-semibold leading-tight";
const more = "group inline-flex min-h-11 items-center gap-2 text-[0.9375rem] font-medium text-season-ink";

/** A title won: its medal, the name and how often, and where it was won. */
function TitleItem({ title: { def, occasions }, all = false }: { title: Title; all?: boolean }) {
  const where = occasions.map((o) => eventTitle(o.label)).filter(Boolean);
  return (
    <li className="flex min-w-0 items-center gap-3.5" title={def.description}>
      <Medal def={def} size={52} year={occasions.length === 1 ? occasions[0]!.year : null} />
      <div className="min-w-0">
        <p className="flex items-baseline gap-2 text-[1.0625rem] font-semibold leading-snug">
          <span className="truncate">{def.name}</span>
          {occasions.length > 1 && <span className="shrink-0 text-[0.9375rem] tabular-nums text-season-amber">×{occasions.length}</span>}
        </p>
        {where.length > 0 &&
          (all ? (
            <ul className="mt-0.5 space-y-0.5 text-[0.9375rem] text-season-muted">
              {where.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          ) : (
            <p className="truncate text-[0.9375rem] text-season-muted">
              {where[0]}
              {where.length > 1 && ` · +${where.length - 1} more`}
            </p>
          ))}
      </div>
    </li>
  );
}

type Achievement = {
  type: string; title: string; unit: (n: number) => string; current: number;
  level: BadgeDefinition | null; next: BadgeDefinition | null; target: number | null; levels: number; reachedCount: number;
};

/** Every achievement ladder: current level, and progress to the next one. */
function AchievementList({ items, className = "" }: { items: Achievement[]; className?: string }) {
  return (
    <ul className={className}>
      {items.map((a) => {
        const shown = a.level ?? a.next;
        const pct = a.target ? Math.min(100, Math.round((a.current / a.target) * 100)) : 100;
        return (
          <li key={a.type} className="flex items-center gap-4 border-b border-white/[0.07] py-4">
            <span>
              {shown ? <Medal def={shown} size={44} muted={!a.level} /> : <Lock size={22} className="text-season-muted/60" aria-hidden="true" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-[1.0625rem] font-semibold">{a.title}</span>
                <span className="shrink-0 text-[0.875rem] tabular-nums text-season-muted">
                  {a.level ? `${TIER_LABEL[a.level.tier]} · ` : ""}level {a.reachedCount}/{a.levels}
                </span>
              </div>
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"
                role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${a.title} progress`}
              >
                <div className={`h-full rounded-full ${a.next ? "bg-season-amber" : "bg-season-up"}`} style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1.5 text-[0.875rem] text-season-muted">
                {a.next && a.target != null
                  ? `${a.unit(Math.round(a.current)).replace(/ in one go$/, "")} · next: ${a.next.name} at ${a.unit(a.target)}`
                  : `Top level reached: ${a.level?.name}`}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

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

type ResultRow = {
  id: number; event_id: number; event_name: string; date: string | null; casino: string | null;
  position: number | null; points: number; prize: number;
};

/** Cashes as calm rows: date, event and venue, finish, points (and prize where there's room). */
function ResultsTable({ rows, prize = true }: { rows: ResultRow[]; prize?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-white/[0.12] text-[0.875rem] text-season-muted">
            <th scope="col" className="hidden pb-3 pr-6 font-medium sm:table-cell">Date</th>
            <th scope="col" className="w-full pb-3 font-medium">Event</th>
            <th scope="col" className="pb-3 pl-4 text-right font-medium">Finish</th>
            <th scope="col" className="pb-3 pl-4 text-right font-medium">Points</th>
            {prize && <th scope="col" className="hidden pb-3 pl-6 text-right font-medium md:table-cell">Prize</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-white/[0.07] transition-colors hover:bg-white/[0.025]">
              <td className="hidden whitespace-nowrap py-4 pr-6 tabular-nums text-season-muted sm:table-cell">{date(r.date)}</td>
              <td className="max-w-0 py-3.5">
                <Link href={`/events/e/${r.event_id}`} className="block truncate text-[1.0625rem] font-medium decoration-season-ink/40 underline-offset-4 hover:underline" title={r.event_name}>
                  {eventTitle(r.event_name)}
                </Link>
                <span className="block truncate text-[0.875rem] text-season-muted">
                  <span className="sm:hidden">{date(r.date)} · </span>
                  {r.casino}
                </span>
              </td>
              <td className="whitespace-nowrap py-3.5 pl-4 text-right tabular-nums">
                {r.position === 1 ? (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-season-amber">
                    <Trophy size={14} aria-hidden="true" /> 1st
                  </span>
                ) : r.position ? (
                  ordinal(r.position)
                ) : (
                  <span className="text-season-muted">–</span>
                )}
              </td>
              <td className="whitespace-nowrap py-3.5 pl-4 text-right font-semibold tabular-nums text-season-amber">{pts(r.points)}</td>
              {prize && <td className="hidden whitespace-nowrap py-3.5 pl-6 text-right tabular-nums text-season-ink/75 md:table-cell">{r.prize > 0 ? money(r.prize) : "–"}</td>}
            </tr>
          ))}
          {!rows.length && (
            <tr><td colSpan={5} className="py-14 text-center text-season-ink/80">No results here.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

type ResultSort = "date" | "event" | "finish" | "points" | "prize";
type SortDir = "asc" | "desc";
const RESULT_SORTS: ResultSort[] = ["date", "event", "finish", "points", "prize"];
/** The natural first direction for each column: newest, A–Z, best finish, most points, biggest prize. */
const FIRST_DIR: Record<ResultSort, SortDir> = { date: "desc", event: "asc", finish: "asc", points: "desc", prize: "desc" };

/** Order results by a column. Unplaced finishes always go last. */
function sortResults<T extends ResultRow>(rows: T[], by: ResultSort, dir: SortDir) {
  const m = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    switch (by) {
      case "event": return m * a.event_name.localeCompare(b.event_name);
      case "finish": return (a.position ?? Infinity) === (b.position ?? Infinity) ? 0 : a.position == null ? 1 : b.position == null ? -1 : m * (a.position - b.position);
      case "points": return m * (a.points - b.points);
      case "prize": return m * (a.prize - b.prize);
      default: return m * (a.date ?? "").localeCompare(b.date ?? "");
    }
  });
}

/** A column heading that sorts the results; clicking the current one flips the direction. */
function ResultTh({ col, sort, dir, href, className = "", children }: { col: ResultSort; sort: ResultSort; dir: SortDir; href: (c: ResultSort, d: SortDir) => string; className?: string; children: React.ReactNode }) {
  const on = sort === col;
  const next: SortDir = on ? (dir === "asc" ? "desc" : "asc") : FIRST_DIR[col];
  const Arrow = dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th scope="col" aria-sort={on ? (dir === "asc" ? "ascending" : "descending") : undefined} className={`pb-2 font-medium ${className}`}>
      <Link href={href(col, next)} scroll={false} className={`inline-flex min-h-8 items-center gap-1 whitespace-nowrap transition-colors ${on ? "text-season-ink" : "hover:text-season-ink"}`}>
        {children}
        {on && <Arrow size={13} strokeWidth={2.5} className="text-season-amber" aria-hidden="true" />}
        <span className="sr-only">{on ? `(sorted ${dir === "asc" ? "ascending" : "descending"}; click to reverse)` : "(sort by this)"}</span>
      </Link>
    </th>
  );
}

/**
 * The Results tab's list: one compact line per cash (date, event and venue, finish, points, prize), so a long
 * career stays a short scroll. Paged.
 */
function CompactResults({ rows, sort, dir, sortHref }: { rows: ResultRow[]; sort: ResultSort; dir: SortDir; sortHref: (c: ResultSort, d: SortDir) => string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-[0.9375rem] tabular-nums">
        <thead>
          <tr className="border-b border-white/[0.12] text-[0.8125rem] text-season-muted">
            <ResultTh col="date" sort={sort} dir={dir} href={sortHref} className="pr-5">Date</ResultTh>
            <ResultTh col="event" sort={sort} dir={dir} href={sortHref} className="w-full">Event</ResultTh>
            <ResultTh col="finish" sort={sort} dir={dir} href={sortHref} className="pl-4 text-right">Finish</ResultTh>
            <ResultTh col="points" sort={sort} dir={dir} href={sortHref} className="pl-4 text-right">Points</ResultTh>
            <ResultTh col="prize" sort={sort} dir={dir} href={sortHref} className="hidden pl-5 text-right sm:table-cell">Prize</ResultTh>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-white/[0.06] transition-colors hover:bg-white/[0.025]">
              <td className="whitespace-nowrap py-2.5 pr-5 text-season-muted">
                {r.date ? new Date(r.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" }) : "–"}
              </td>
              <td className="max-w-0 py-2.5">
                <Link href={`/events/e/${r.event_id}`} className="block truncate decoration-season-ink/40 underline-offset-4 hover:underline" title={`${r.event_name}${r.casino ? ` · ${r.casino}` : ""}`}>
                  <span className="font-medium">{eventTitle(r.event_name)}</span>
                  {r.casino && <span className="hidden text-season-muted lg:inline"> · {r.casino}</span>}
                </Link>
              </td>
              <td className="whitespace-nowrap py-2.5 pl-4 text-right">
                {r.position === 1 ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-season-amber"><Trophy size={13} aria-hidden="true" /> 1st</span>
                ) : r.position ? ordinal(r.position) : <span className="text-season-muted">–</span>}
              </td>
              <td className="whitespace-nowrap py-2.5 pl-4 text-right font-semibold text-season-amber">{pts(r.points)}</td>
              <td className="hidden whitespace-nowrap py-2.5 pl-5 text-right text-season-ink/75 sm:table-cell">{r.prize > 0 ? money(r.prize) : "–"}</td>
            </tr>
          ))}
          {!rows.length && (
            <tr><td colSpan={5} className="py-12 text-center text-season-ink/80">No results here.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const RESULTS_PAGE = 20;

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "results", label: "Results" },
  { key: "achievements", label: "Achievements" },
] as const;
type Tab = (typeof TABS)[number]["key"];

/**
 * The opening still: a lit trophy cabinet that dissolves into the page, the player over its dark side.
 * The photo is a generated stand-in (no real people); swap in real event photography.
 */
async function Hero({ children }: { children: React.ReactNode }) {
  const img = await getSiteImages();
  return (
    <section className="relative isolate flex min-h-[clamp(20rem,23vw,25rem)] items-end overflow-hidden">
      {/* The cabinet runs the full width; it darkens gently on the left, behind the name. */}
      <Image src={img.profile_hero} alt="" fill priority sizes="100vw" className="-z-10 object-cover object-[70%_45%]" />
      <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-10 h-28 bg-gradient-to-b from-season-night/60 to-transparent" />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-[50%] bg-gradient-to-t from-season-night via-season-night/55 to-transparent" />
      <div aria-hidden="true" className="absolute inset-y-0 left-0 -z-10 w-full bg-gradient-to-r from-season-night/80 via-season-night/35 via-45% to-transparent to-75%" />
      <div className="rise w-full px-4 pb-[clamp(2rem,3vw,3rem)] pt-[9rem] sm:px-[3.6vw]">{children}</div>
    </section>
  );
}

export default async function PlayerProfile(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; season?: string; series?: string; page?: string; sort?: string; dir?: string }>;
}) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const tab: Tab = sp.tab === "results" || sp.tab === "achievements" ? sp.tab : "overview";

  const data = await getPlayerProfile(id);

  if (!data) {
    return (
      <div className="bg-season-night font-season text-season-ink">
        <Hero>
          <h1 className="text-[clamp(2rem,3vw,3.25rem)] font-bold leading-[1.04] tracking-[-0.01em]">Player not found</h1>
          <p className="mt-3 max-w-[32em] text-[clamp(1.0625rem,1.2vw,1.25rem)] text-season-ink/85">
            This profile doesn&apos;t exist or may have been merged with another.
          </p>
          <Link href="/players" className={`${more} mt-4`}>
            <ArrowLeft size={17} strokeWidth={2.25} aria-hidden="true" /> All players
          </Link>
        </Hero>
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
  const active = seasons.find((s) => s.active) ?? null;
  const nplNow = active?.leagues.npl ?? null;
  const latest = seasons[0] ?? null;

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
  // Results tab sorting: any column, either way; newest first by default.
  const rSort: ResultSort = RESULT_SORTS.includes(sp.sort as ResultSort) ? (sp.sort as ResultSort) : "date";
  const rDir: SortDir = sp.dir === "asc" || sp.dir === "desc" ? sp.dir : FIRST_DIR[rSort];
  const filterHref = (season: number | null, series: number | null, page?: number, sort: ResultSort = rSort, dir: SortDir = rDir) => {
    const q = new URLSearchParams({ tab: "results" });
    if (season) q.set("season", String(season));
    if (series) q.set("series", String(series));
    if (page && page > 1) q.set("page", String(page));
    if (sort !== "date" || dir !== "desc") {
      q.set("sort", sort);
      q.set("dir", dir);
    }
    return `${base}?${q}`;
  };
  const sortHref = (sort: ResultSort, dir: SortDir) => `${filterHref(seasonFilter, seriesFilter, 1, sort, dir)}#results-list`;
  const sorted = sortResults(filtered, rSort, rDir);
  const resultPages = Math.max(1, Math.ceil(sorted.length / RESULTS_PAGE));
  const resultPage = Math.min(resultPages, Math.max(1, Number(sp.page) || 1));
  const pageRows = sorted.slice((resultPage - 1) * RESULTS_PAGE, resultPage * RESULTS_PAGE);
  // The chart for the Results tab: points from the filtered results, added up in date order.
  const filteredProgress = [...filtered]
    .filter((r) => r.date)
    .sort((a, b) => a.date!.localeCompare(b.date!))
    .reduce<{ date: string; points: number; event: string }[]>((acc, r) => {
      const prev = acc.length ? acc[acc.length - 1].points : 0;
      acc.push({ date: r.date!, points: Math.round((prev + r.points) * 100) / 100, event: eventTitle(r.event_name) });
      return acc;
    }, []);
  const filterLabel = [seasonFilter ? String(seasonFilter) : null, seriesFilter ? series_names.get(seriesFilter) ?? null : null].filter(Boolean).join(" · ");
  const chip = (on: boolean) =>
    `inline-flex h-10 items-center rounded-[3px] px-3.5 text-[0.9375rem] font-medium transition-colors ${
      on ? "bg-season-amber/[0.12] font-semibold text-season-ink shadow-[inset_0_0_0_1px_var(--color-season-amber)]" : "text-season-ink/75 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.12)] hover:text-season-ink"
    }`;

  const career = [
    { label: "Points", value: Math.round(stats.lifetime_points).toLocaleString("en-GB") },
    { label: "Cashes", value: stats.results_count.toLocaleString("en-GB") },
    { label: "Wins", value: stats.total_wins.toLocaleString("en-GB") },
    { label: "Final tables", value: stats.final_tables.toLocaleString("en-GB") },
    { label: "Best finish", value: stats.best_finish ? ordinal(stats.best_finish) : "–" },
    { label: "Win rate per cash", value: `${winRate}%` },
    { label: "Winnings", value: money(stats.total_earnings) },
  ];

  return (
    <div className="bg-season-night font-season text-season-ink">
      <Hero>
        <div>
          <div className="min-w-0">
            <h1 className="text-[clamp(2rem,3.2vw,3.5rem)] font-bold leading-[1.02] tracking-[-0.012em] [overflow-wrap:anywhere]">{p.name}</h1>
            <p className="mt-2 text-[clamp(1.0625rem,1.45vw,1.375rem)] font-medium text-season-muted">
              {nplNow && active ? (
                <>
                  NPL {ordinal(nplNow.position)} in {active.year} <span aria-hidden="true">·</span>{" "}
                  <span className="font-semibold tabular-nums text-season-amber">{pts(nplNow.points)} pts</span>
                </>
              ) : latest?.leagues.npl ? (
                <>NPL {ordinal(latest.leagues.npl.position)} in {latest.year}</>
              ) : (
                <>
                  <span className="tabular-nums">{stats.results_count}</span> {stats.results_count === 1 ? "cash" : "cashes"} in the National Poker League
                </>
              )}
            </p>
          </div>
        </div>
        {titles.length > 0 && (
          <section aria-labelledby="titles-heading" className="mt-[clamp(1.75rem,2.6vw,2.5rem)]">
            <h2 id="titles-heading" className="sr-only">Titles</h2>
            <ul className="grid gap-x-[clamp(1.5rem,3vw,3rem)] gap-y-4 sm:grid-cols-2 lg:flex lg:flex-wrap [&>li]:lg:max-w-[22rem]">
              {titles.slice(0, 3).map((t) => <TitleItem key={t.def.key} title={t} />)}
            </ul>
            {titles.length > 3 && (
              <Link href={`${base}?tab=achievements`} scroll={false} className={`${more} mt-2`}>
                All {totalTitles} titles
                <ArrowRight size={17} strokeWidth={2.25} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            )}
          </section>
        )}
      </Hero>

      <div className="px-4 pb-[clamp(2.5rem,4vw,4rem)] sm:px-[3.6vw]">
        {/* Sections, with the actions beside them */}
        <div className="flex flex-col-reverse gap-4 border-b border-white/[0.1] md:flex-row md:items-end md:justify-between">
          <nav aria-label="Player sections" className="no-scrollbar -mx-4 flex gap-8 overflow-x-auto px-4 md:mx-0 md:px-0">
            {TABS.map((t) => (
              <Link
                key={t.key}
                href={t.key === "overview" ? base : `${base}?tab=${t.key}`}
                scroll={false}
                aria-current={tab === t.key ? "page" : undefined}
                className={`relative flex h-12 items-center whitespace-nowrap text-[1.0625rem] font-medium transition-colors ${
                  tab === t.key ? "text-season-ink after:absolute after:inset-x-0 after:bottom-[-1px] after:h-[3px] after:bg-season-amber" : "text-season-ink/65 hover:text-season-ink"
                }`}
              >
                {t.label}
                {t.key === "results" && <span className="ml-2 tabular-nums text-season-muted">{all_results.length}</span>}
                {t.key === "achievements" && totalTitles > 0 && <span className="ml-2 tabular-nums text-season-muted">{totalTitles}</span>}
              </Link>
            ))}
          </nav>
          <div className="flex flex-wrap gap-3 md:pb-2.5">
            <Link
              href={`/compare?a=${p.id}`}
              className="inline-flex h-11 items-center gap-2 rounded-[3px] border border-white/[0.14] px-4 text-[0.9375rem] font-medium transition-colors hover:border-white/30"
            >
              <Swords size={16} aria-hidden="true" /> Compare with another player
            </Link>
            <ShareButton
              title={`${p.name} · National Poker League`}
              className="inline-flex h-11 items-center gap-2 rounded-[3px] border border-white/[0.14] px-4 text-[0.9375rem] font-medium text-season-ink transition-colors hover:border-white/30"
            />
          </div>
        </div>

        {/* --- OVERVIEW --- */}
        {tab === "overview" && (
          <>
            <div className="mt-[clamp(2rem,3vw,2.75rem)] grid gap-x-[clamp(2rem,4vw,4.5rem)] gap-y-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
              <div className="min-w-0 space-y-10">
                {active ? (
                  <section aria-labelledby="season-now">
                    <h2 id="season-now" className={h2}>{active.year} so far</h2>
                    <ul className="mt-5 grid grid-cols-3 gap-4">
                      {LEAGUES.map(({ slug, label }) => {
                        const l = active.leagues[slug];
                        const mark = LEAGUE_MARKS[slug];
                        return (
                          <li key={slug} className="min-w-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={mark.src} alt={label} width={mark.width} height={mark.height} className="block h-[1.125rem] w-auto max-w-full object-contain object-left sm:h-[1.375rem]" />
                            {l ? (
                              <Link href={`/leaderboards${slug === "npl" ? "" : `?league=${slug}`}`} className="mt-3 block hover:underline hover:decoration-season-ink/40 hover:underline-offset-4">
                                <span className={`block text-[clamp(1.75rem,2.6vw,2.5rem)] font-bold leading-none tabular-nums ${l.position <= 3 ? "text-season-amber" : "text-season-ink"}`}>
                                  {ordinal(l.position)}
                                </span>
                                <span className="mt-1.5 block text-[0.9375rem] tabular-nums text-season-muted">{pts(l.points)} pts</span>
                              </Link>
                            ) : (
                              <span className="mt-3 block text-[0.9375rem] text-season-muted">Not ranked</span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                    <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-white/[0.08] pt-5">
                      {[
                        { label: active.cashes === 1 ? "Cash" : "Cashes", value: active.cashes },
                        { label: active.wins === 1 ? "Win" : "Wins", value: active.wins },
                        { label: "Final tables", value: active.final_tables },
                      ].map((s) => (
                        <div key={s.label} className="flex flex-col-reverse">
                          <dt className="text-[0.9375rem] text-season-muted">{s.label}</dt>
                          <dd className="text-[1.625rem] font-semibold leading-tight tabular-nums">{s.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                ) : null}

                <section aria-labelledby="career">
                  <h2 id="career" className={h2}>Career</h2>
                  <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-white/[0.08] pt-5 sm:grid-cols-4">
                    {career.map((s, i) => (
                      <div key={s.label} className="flex flex-col-reverse">
                        <dt className="text-[0.9375rem] text-season-muted">{s.label}</dt>
                        <dd className={`text-[1.5rem] font-semibold leading-tight tabular-nums ${i === 0 ? "text-season-amber" : ""}`}>{s.value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              </div>

              <section aria-labelledby="recent-cashes" className="min-w-0">
                <h2 id="recent-cashes" className={h2}>Recent cashes</h2>
                <div className="mt-5">
                  <ResultsTable rows={all_results.slice(0, 5)} prize={false} />
                </div>
                {all_results.length > 5 && (
                  <Link href={`${base}?tab=results`} scroll={false} className={`${more} mt-2`}>
                    All {all_results.length} results
                    <ArrowRight size={17} strokeWidth={2.25} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
                  </Link>
                )}
              </section>
            </div>

            <section aria-labelledby="trajectory" className="mt-[clamp(3rem,5vw,4.5rem)]">
              <h2 id="trajectory" className={h2}>NPL points this season</h2>
              <p className="mt-1 text-[0.9375rem] text-season-muted">How the season total built up, cash by cash.</p>
              <div className={`${card} mt-5 p-3 sm:p-5`}>
                <SeasonPointsChart data={season_progress} />
              </div>
            </section>

            <div className="mt-[clamp(3rem,5vw,4.5rem)] grid gap-x-[clamp(2rem,4vw,4.5rem)] gap-y-12 lg:grid-cols-2">
              {seasons.length > 0 && (
                <section aria-labelledby="by-season" className="min-w-0">
                  <h2 id="by-season" className={h2}>Season by season</h2>
                  <div className="mt-5 overflow-x-auto">
                    <table className="w-full border-collapse text-left tabular-nums">
                      <thead>
                        <tr className="border-b border-white/[0.12] text-[0.875rem] text-season-muted">
                          <th scope="col" className="pb-3 font-medium">Season</th>
                          <th scope="col" className="pb-3 pl-4 text-right font-medium">NPL</th>
                          <th scope="col" className="pb-3 pl-4 text-right font-medium"><span className="sm:hidden">HRL</span><span className="hidden sm:inline">High Roller</span></th>
                          <th scope="col" className="pb-3 pl-4 text-right font-medium"><span className="sm:hidden">LRL</span><span className="hidden sm:inline">Low Roller</span></th>
                          <th scope="col" className="pb-3 pl-4 text-right font-medium">Cashes</th>
                          <th scope="col" className="hidden pb-3 pl-4 text-right font-medium sm:table-cell">Wins</th>
                        </tr>
                      </thead>
                      <tbody>
                        {seasons.map((s) => (
                          <tr key={s.season_id} className="border-b border-white/[0.07]">
                            <td className="py-3.5 font-semibold">
                              {s.year}
                              {s.active && <span className="ml-2 text-[0.875rem] font-normal text-season-muted">so far</span>}
                            </td>
                            {LEAGUES.map(({ slug }) => {
                              const l = s.leagues[slug];
                              return (
                                <td key={slug} className="py-3.5 pl-4 text-right">
                                  {l ? (
                                    <span className={l.position <= 3 ? "font-semibold text-season-amber" : ""} title={`${pts(l.points)} pts`}>
                                      {ordinal(l.position)}
                                    </span>
                                  ) : <span className="text-season-muted">–</span>}
                                </td>
                              );
                            })}
                            <td className="py-3.5 pl-4 text-right">{s.cashes}</td>
                            <td className="hidden py-3.5 pl-4 text-right sm:table-cell">{s.wins || <span className="text-season-muted">–</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {best_results.length > 0 && (
                <section aria-labelledby="best-results" className="min-w-0">
                  <h2 id="best-results" className={h2}>Best results</h2>
                  <ol className="mt-5 border-t border-white/[0.12]">
                    {best_results.map((r) => (
                      <li key={r.id} className="border-b border-white/[0.07]">
                        <Link href={`/events/e/${r.event_id}`} className="group flex items-baseline justify-between gap-4 py-3.5">
                          <span className="min-w-0">
                            <span className="block truncate text-[1.0625rem] font-medium decoration-season-ink/40 underline-offset-4 group-hover:underline" title={r.event_name}>
                              {eventTitle(r.event_name)}
                            </span>
                            <span className="block text-[0.875rem] text-season-muted">
                              {r.position === 1 ? "Winner" : r.position ? ordinal(r.position) : "–"} · {date(r.date, false)}
                            </span>
                          </span>
                          <span className="shrink-0 tabular-nums text-season-ink/80">{r.prize ? money(r.prize) : `${pts(r.points)} pts`}</span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </div>

            <section aria-labelledby="achievements-heading" className="mt-[clamp(3rem,5vw,4.5rem)]">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <h2 id="achievements-heading" className={h2}>Achievements</h2>
                <span className="text-[0.9375rem] text-season-muted">{achievements.filter((a) => a.level).length} of {achievements.length} started</span>
              </div>
              <AchievementList items={rankedAchievements.slice(0, 4)} className="mt-3 grid gap-x-12 md:grid-cols-2" />
              <Link href={`${base}?tab=achievements`} scroll={false} className={`${more} mt-2`}>
                All {achievements.length} achievements
                <ArrowRight size={17} strokeWidth={2.25} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </section>
          </>
        )}

        {/* --- RESULTS --- */}
        {tab === "results" && (
          <div className="mt-[clamp(2rem,3vw,2.75rem)]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-2 w-14 text-[0.9375rem] text-season-muted">Season</span>
                <Link href={filterHref(null, seriesFilter)} scroll={false} className={chip(!seasonFilter)} aria-current={!seasonFilter ? "page" : undefined}>All</Link>
                {seasonYears.map((y) => (
                  <Link key={y} href={filterHref(y, seriesFilter)} scroll={false} className={chip(seasonFilter === y)} aria-current={seasonFilter === y ? "page" : undefined}>{y}</Link>
                ))}
              </div>
              {playerSeries.length > 1 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-2 w-14 text-[0.9375rem] text-season-muted">Series</span>
                  <Link href={filterHref(seasonFilter, null)} scroll={false} className={chip(!seriesFilter)} aria-current={!seriesFilter ? "page" : undefined}>All</Link>
                  {playerSeries.map((x) => (
                    <Link key={x.id} href={filterHref(seasonFilter, x.id)} scroll={false} className={chip(seriesFilter === x.id)} aria-current={seriesFilter === x.id ? "page" : undefined}>{x.name}</Link>
                  ))}
                </div>
              )}
            </div>

            <section aria-labelledby="results-chart" className="mt-8">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <h2 id="results-chart" className={h2}>{filterLabel ? `Points · ${filterLabel}` : "Points over the career"}</h2>
                <span className="text-[0.9375rem] tabular-nums text-season-muted">
                  {filtered.length} {filtered.length === 1 ? "cash" : "cashes"} · {filtered.filter((r) => r.position === 1).length} wins ·{" "}
                  {pts(filtered.reduce((n, r) => n + r.points, 0))} points · {money(filtered.reduce((n, r) => n + r.prize, 0))} won
                </span>
              </div>
              <div className={`${card} mt-4 p-3 sm:p-5`}>
                <SeasonPointsChart data={filteredProgress} empty="The chart appears when there are at least two results to draw." />
              </div>
            </section>

            <section id="results-list" aria-labelledby="all-results" className="mt-10 scroll-mt-28">
              <h2 id="all-results" className="sr-only">Results</h2>
              <CompactResults rows={pageRows} sort={rSort} dir={rDir} sortHref={sortHref} />
              {resultPages > 1 && (
                <nav aria-label="Result pages" className="mt-4 flex items-center justify-between gap-4">
                  <span className="text-[0.875rem] tabular-nums text-season-muted">
                    {(resultPage - 1) * RESULTS_PAGE + 1}–{Math.min(resultPage * RESULTS_PAGE, filtered.length)} of {filtered.length}
                  </span>
                  <div className="flex flex-wrap items-center justify-end gap-1">
                    {Array.from({ length: resultPages }, (_, i) => i + 1).map((n) => (
                      <Link
                        key={n}
                        href={`${filterHref(seasonFilter, seriesFilter, n)}#results-list`}
                        scroll={false}
                        aria-current={n === resultPage ? "page" : undefined}
                        aria-label={`Page ${n}`}
                        className={`inline-flex size-11 items-center justify-center rounded-[3px] text-[0.9375rem] tabular-nums transition-colors sm:size-10 ${
                          n === resultPage ? "font-semibold text-season-ink shadow-[inset_0_0_0_1px_var(--color-season-amber)]" : "text-season-ink/75 hover:bg-white/[0.06] hover:text-season-ink"
                        }`}
                      >
                        {n}
                      </Link>
                    ))}
                  </div>
                </nav>
              )}
            </section>
          </div>
        )}

        {/* --- ACHIEVEMENTS --- */}
        {tab === "achievements" && (
          <div className="mt-[clamp(2rem,3vw,2.75rem)] space-y-[clamp(3rem,5vw,4.5rem)]">
            <section aria-labelledby="all-titles">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <h2 id="all-titles" className={h2}>Trophy cabinet</h2>
                <Link href="/badges" className="text-[0.9375rem] text-season-muted hover:text-season-ink">
                  {totalTitles} title{totalTitles === 1 ? "" : "s"} · all badges
                </Link>
              </div>
              {titles.length ? (
                <ul className="mt-6 grid items-start gap-x-12 gap-y-6 md:grid-cols-2 xl:grid-cols-3">
                  {titles.map((t) => <TitleItem key={t.def.key} title={t} all />)}
                </ul>
              ) : (
                <p className="mt-4 text-season-ink/80">No titles yet. Win a series Main Event or finish on a league podium to earn one.</p>
              )}
            </section>

            <section aria-labelledby="all-achievements">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <h2 id="all-achievements" className={h2}>Achievements</h2>
                <Link href="/badges?tab=achievements" className="text-[0.9375rem] text-season-muted hover:text-season-ink">
                  {achievements.filter((a) => a.level).length} of {achievements.length} started · all levels
                </Link>
              </div>
              <AchievementList items={rankedAchievements} className="mt-3 grid gap-x-12 md:grid-cols-2" />
            </section>
          </div>
        )}

        {/* The way for a player to ask for their name to come off the site, or a result to be corrected. */}
        <p className="mt-[clamp(3rem,5vw,4.5rem)] border-t border-white/[0.08] pt-5 text-[0.9375rem] text-season-muted">
          Is this you? You can{" "}
          <Link href="/contact?topic=privacy" className="text-season-ink underline decoration-season-ink/30 underline-offset-4 hover:decoration-season-ink">
            ask to be shown by initials
          </Link>{" "}
          or{" "}
          <Link href="/contact?topic=correction" className="text-season-ink underline decoration-season-ink/30 underline-offset-4 hover:decoration-season-ink">
            report a wrong result
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
