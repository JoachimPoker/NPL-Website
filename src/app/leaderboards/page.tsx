import Link from "next/link";
import { ChevronLeft, ChevronRight, Crown, Search, TrendingUp, Trophy, Zap, type LucideIcon } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import ShareButton from "@/components/ShareButton";
import { Initial } from "@/components/HomeLeaderboard";
import { BADGE_ICONS } from "@/components/badges/BadgeMedal";
import RaceChart from "@/components/leaderboards/RaceChart";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import {
  type AllTimeSort, type BoardRow, type LeagueSlug, type Prize, type TitleIcon,
  PAGE_SIZE, allTimeBoard, formatRules, getLeagues, getSeasons, movementFor, prizesFor, seasonBoard, seasonRace, thisWeek, titlesFor,
} from "@/lib/leaderboards";

export const dynamic = "force-dynamic";

type SP = { season?: string; league?: string; page?: string; q?: string; sort?: string };

const SORTS: { key: AllTimeSort; label: string }[] = [
  { key: "points", label: "Points" },
  { key: "money", label: "Winnings" },
  { key: "wins", label: "Wins" },
  { key: "cashes", label: "Cashes" },
];

const gbp = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;

/** Titles held, as small gold icons (all of them unless a max is given, then "+N"). */
function TitleIcons({ titles, max = 99 }: { titles: TitleIcon[]; max?: number }) {
  if (!titles.length) return null;
  return (
    <span className="flex shrink-0 flex-wrap items-center gap-1">
      {titles.slice(0, max).map((t) => {
        const Icon: LucideIcon = BADGE_ICONS[t.icon ?? ""] ?? Trophy;
        const label = `${t.name}${t.count > 1 ? ` ×${t.count}` : ""}`;
        return (
          <span
            key={t.key}
            title={label}
            aria-label={label}
            role="img"
            className="relative flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-inset ring-primary/30"
          >
            <Icon size={11} strokeWidth={2.4} aria-hidden="true" />
            {t.count > 1 && (
              <span className="absolute -right-1.5 -top-1.5 rounded-full bg-primary px-1 font-mono text-[8px] font-bold leading-[12px] text-primary-content">
                {t.count}
              </span>
            )}
          </span>
        );
      })}
      {titles.length > max && (
        <span className="font-mono text-[10px] text-base-content/45" title={titles.slice(max).map((t) => t.name).join(", ")}>
          +{titles.length - max}
        </span>
      )}
    </span>
  );
}

function Movement({ move }: { move: number | null }) {
  if (move == null) return null;
  if (move === 0) return <span className="text-[10px] text-base-content/25" aria-label="No change">–</span>;
  return move > 0 ? (
    <span className="text-[10px] font-medium text-success" aria-label={`Up ${move}`}>▲{move}</span>
  ) : (
    <span className="text-[10px] font-medium text-error" aria-label={`Down ${-move}`}>▼{-move}</span>
  );
}

export default async function LeaderboardsPage(props: { searchParams: Promise<SP> }) {
  const sp = await props.searchParams;
  const db = await createSupabaseServerClient();

  const seasons = await getSeasons(db);
  const allTime = sp.season === "all";
  const season = allTime ? null : seasons.find((s) => String(s.year) === sp.season) ?? seasons.find((s) => s.is_active) ?? seasons[0] ?? null;
  const leagues = await getLeagues(db, season?.id ?? null);
  const league = leagues.find((l) => l.slug === sp.league) ?? leagues[0] ?? null;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q?.trim() || null;
  const sort: AllTimeSort = SORTS.some((s) => s.key === sp.sort) ? (sp.sort as AllTimeSort) : "points";

  const href = (patch: Partial<SP>) => {
    const next: SP = {
      season: allTime ? "all" : season && !season.is_active ? String(season.year) : undefined,
      league: league && league.slug !== "npl" ? league.slug : undefined,
      sort: allTime && sort !== "points" ? sort : undefined,
      q: q ?? undefined,
      page: undefined,
      ...patch,
    };
    const params = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]);
    const s = params.toString();
    return s ? `/leaderboards?${s}` : "/leaderboards";
  };

  if (!league) {
    return (
      <>
        <PageHeader eyebrow="Leaderboards" title="Leaderboards" description="No leagues have been set up yet." />
        <div className="mx-auto max-w-7xl px-4 py-16 text-center text-base-content/50">Results appear here after the first import.</div>
      </>
    );
  }

  // The table page, plus the (unfiltered) top of the table for the podium and race chart.
  // (If the all-time function isn't installed yet, show an empty table rather than an error page.)
  const load = (p: number, search: string | null) =>
    (allTime ? allTimeBoard(db, league.slug, sort, p, search) : seasonBoard(db, league.id, p, search)).catch(() => ({ rows: [] as BoardRow[], total: 0 }));
  const board = await load(page, q);
  const top = page === 1 && !q ? board.rows.slice(0, 5) : (await load(1, null)).rows.slice(0, 5);

  const ids = [...new Set([...board.rows, ...top].map((r) => r.player_id))];
  const current = !!season?.is_active;
  const [titles, movement, prizes, race] = await Promise.all([
    titlesFor(db, ids, season?.year ?? null),
    current && season ? movementFor(db, season.id, league.slug as LeagueSlug, board.rows.map((r) => r.player_id)) : Promise.resolve(new Map<number, number>()),
    season ? prizesFor(db, season.id, league.slug as LeagueSlug) : Promise.resolve([] as Prize[]),
    season ? seasonRace(db, season.id, league, top) : Promise.resolve(null),
  ]);
  const withExtras = (r: BoardRow): BoardRow => ({ ...r, titles: titles.get(r.player_id) ?? [], movement: movement.get(r.player_id) ?? null });
  const rows = board.rows.map(withExtras);
  const podium = top.slice(0, 3).map(withExtras);
  const names = new Map([...board.rows, ...top].map((r) => [r.player_id, r.display_name]));
  const week = current && season ? await thisWeek(db, season.id, league.slug as LeagueSlug, names) : [];

  const pages = Math.max(1, Math.ceil(board.total / PAGE_SIZE));
  const lastPaid = prizes.length ? Math.max(...prizes.map((p) => p.position_to)) : null;
  const prizeFor = (pos: number) => prizes.find((p) => pos >= p.position_from && pos <= p.position_to) ?? null;
  const capped = !allTime && league.scoring_method === "capped";
  const seasonLabel = season ? season.name : "All-time";

  return (
    <>
      <PageHeader
        eyebrow={allTime ? "All-time leaderboards" : `${seasonLabel} leaderboards`}
        title={allTime ? "The all-time leaderboard" : current ? "Who's leading the season" : `${season!.year} final leaderboard`}
        description={
          allTime
            ? "Every result since 2024 added up. Sort by points, winnings, wins or cashes."
            : current
              ? "Points from every counted result, updated after each weekly import."
              : `How the ${season!.year} season finished.`
        }
        actions={<ShareButton title={`NPL ${allTime ? "all-time" : seasonLabel} leaderboard`} />}
      />

      <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        {/* Season, league and search */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <nav aria-label="Season" className="inline-flex rounded-lg bg-base-100 p-1 ring-1 ring-inset ring-base-content/[0.07]">
              {seasons.map((s) => {
                const active = !allTime && season?.id === s.id;
                return (
                  <Link
                    key={s.id}
                    href={href({ season: s.is_active ? undefined : String(s.year), league: undefined, sort: undefined, q: undefined })}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
                      active ? "bg-primary text-primary-content" : "text-base-content/60 hover:text-base-content"
                    }`}
                  >
                    {s.year}
                  </Link>
                );
              })}
              <Link
                href={href({ season: "all", league: undefined, q: undefined })}
                aria-current={allTime ? "page" : undefined}
                className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  allTime ? "bg-primary text-primary-content" : "text-base-content/60 hover:text-base-content"
                }`}
              >
                All-time
              </Link>
            </nav>

            <nav aria-label="League" className="inline-flex rounded-lg bg-base-100 p-1 ring-1 ring-inset ring-base-content/[0.07]">
              {leagues.map((l) => (
                <Link
                  key={l.slug}
                  href={href({ league: l.slug === "npl" ? undefined : l.slug, q: undefined })}
                  aria-current={l.slug === league.slug ? "page" : undefined}
                  className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    l.slug === league.slug ? "bg-base-content/10 text-base-content" : "text-base-content/60 hover:text-base-content"
                  }`}
                >
                  <span className="sm:hidden">{l.slug.toUpperCase()}</span>
                  <span className="hidden sm:inline">{l.label}</span>
                </Link>
              ))}
            </nav>
          </div>

          <form action="/leaderboards" className="relative w-full lg:w-72" role="search">
            {allTime && <input type="hidden" name="season" value="all" />}
            {!allTime && season && !season.is_active && <input type="hidden" name="season" value={season.year} />}
            {league.slug !== "npl" && <input type="hidden" name="league" value={league.slug} />}
            {allTime && sort !== "points" && <input type="hidden" name="sort" value={sort} />}
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" aria-hidden="true" />
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search player"
              aria-label="Search player"
              className="input input-bordered w-full pl-9"
            />
          </form>
        </div>

        {/* League banner and rules */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {league.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={league.logo_url} alt={league.label} className="h-12 w-auto max-w-[24rem] rounded-[4px] object-contain object-left" />
          ) : (
            <h2 className="font-display text-2xl font-semibold">{league.label}</h2>
          )}
          <p className="text-sm text-base-content/55">{formatRules(league, allTime)}</p>
        </div>

        {/* Podium */}
        {podium.length > 0 && (
          <section aria-label="Top three" className="grid gap-4 md:grid-cols-3">
            {podium.map((r, i) => (
              <Link
                key={r.player_id}
                href={`/players/${r.player_id}`}
                className={`panel group relative flex items-center gap-4 overflow-hidden p-5 transition-colors hover:border-primary/40 ${
                  i === 0 ? "ring-1 ring-primary/40 md:order-2" : i === 1 ? "md:order-1" : "md:order-3"
                }`}
              >
                {i === 0 && <div className="felt-glow pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />}
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/12 font-display text-2xl font-bold text-primary ring-1 ring-inset ring-primary/25">
                  {r.display_name.charAt(0).toUpperCase()}
                  <span
                    className={`absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full font-mono text-xs font-bold ring-4 ring-base-100 ${
                      i === 0 ? "bg-primary text-primary-content" : "bg-base-content/80 text-base-100"
                    }`}
                  >
                    {i === 0 && !current && !allTime ? <Crown size={13} aria-hidden="true" /> : i + 1}
                  </span>
                </div>
                <div className="relative min-w-0 flex-1">
                  <div className="eyebrow">
                    {i === 0 ? (allTime ? "All-time #1" : current ? "Leader" : `Champion ${season!.year}`) : i === 1 ? "2nd" : "3rd"}
                  </div>
                  <div className="truncate font-display text-xl font-semibold transition-colors group-hover:text-primary">{r.display_name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-base-content/55">
                    <span className="font-mono font-semibold text-base-content">
                      {allTime && sort === "money" ? gbp(r.money ?? 0) : `${r.points.toFixed(2)} pts`}
                    </span>
                    <span>{r.wins} wins</span>
                    <span>{r.final_tables} FTs</span>
                    <TitleIcons titles={r.titles} />
                  </div>
                </div>
              </Link>
            ))}
          </section>
        )}

        {/* Race chart and this week */}
        {race && race.dates.length > 1 && (
          <div className="grid gap-6 lg:grid-cols-3">
            <section className={`panel ${week.length ? "lg:col-span-2" : "lg:col-span-3"}`} aria-labelledby="race-heading">
              <div className="border-b border-base-content/[0.07] px-6 py-5">
                <h2 id="race-heading" className="font-display text-lg font-semibold">The race</h2>
                <p className="text-sm text-base-content/50">How the top five&apos;s points built up through the season.</p>
              </div>
              <div className="p-4 md:p-6">
                <RaceChart series={race} />
              </div>
            </section>

            {week.length > 0 && (
              <section className="panel p-6" aria-labelledby="week-heading">
                <h2 id="week-heading" className="eyebrow mb-4">This week</h2>
                <ul className="space-y-4">
                  {week.map((w) => {
                    const Icon = w.label.startsWith("Biggest") ? TrendingUp : w.label.startsWith("New") ? Trophy : Zap;
                    return (
                      <li key={w.label}>
                        <Link href={`/players/${w.player_id}`} className="group flex items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-primary/12 text-primary ring-1 ring-inset ring-primary/20">
                            <Icon size={18} aria-hidden="true" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[11px] uppercase tracking-wider text-base-content/45">{w.label}</span>
                            <span className="block truncate font-semibold transition-colors group-hover:text-primary">{w.name}</span>
                            <span className="block text-xs text-base-content/55">{w.detail}</span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </div>
        )}

        {/* All-time sort */}
        {allTime && (
          <nav aria-label="Sort by" className="flex flex-wrap items-center gap-2">
            <span className="eyebrow mr-1">Rank by</span>
            {SORTS.map((s) => (
              <Link
                key={s.key}
                href={href({ sort: s.key === "points" ? undefined : s.key })}
                aria-current={sort === s.key ? "page" : undefined}
                className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors ${
                  sort === s.key ? "bg-primary text-primary-content ring-primary" : "text-base-content/70 ring-base-content/15 hover:text-base-content"
                }`}
              >
                {s.label}
              </Link>
            ))}
          </nav>
        )}

        {/* The table */}
        <section className="panel overflow-hidden" aria-labelledby="table-heading">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-base-content/[0.07] px-6 py-4">
            <h2 id="table-heading" className="font-display text-lg font-semibold">
              {q ? `Players matching “${q}”` : `${board.total.toLocaleString("en-GB")} players`}
            </h2>
            {q && <Link href={href({ q: undefined })} className="text-sm text-primary hover:underline">Clear search</Link>}
          </div>
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th className="w-16 pl-6 text-center">#</th>
                  <th>Player</th>
                  {allTime && <th className="hidden text-right md:table-cell">Seasons</th>}
                  <th className="hidden text-right sm:table-cell" title={capped ? "Counted results / all results" : undefined}>
                    {capped ? "Counted" : "Cashes"}
                  </th>
                  <th className="text-right">Wins</th>
                  <th className="hidden text-right sm:table-cell">FTs</th>
                  {allTime && <th className="hidden text-right md:table-cell">Winnings</th>}
                  {prizes.length > 0 && <th className="hidden lg:table-cell">Prize</th>}
                  <th className="pr-6 text-right">Points</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const prize = prizeFor(r.position);
                  const next = rows[i + 1];
                  const showPrizeLine = lastPaid != null && r.position === lastPaid && next;
                  return [
                    <tr key={r.player_id} className={`transition-colors hover:bg-base-content/[0.03] ${r.position <= 3 ? "bg-primary/[0.035]" : ""}`}>
                      <td className="pl-6 text-center">
                        <div className={`font-mono text-sm ${r.position <= 3 ? "font-semibold text-primary" : "text-base-content/60"}`}>{r.position}</div>
                        <Movement move={r.movement} />
                      </td>
                      <td>
                        <Link href={`/players/${r.player_id}`} className="group flex items-center gap-3">
                          <Initial name={r.display_name} />
                          <span className="truncate font-medium transition-colors group-hover:text-primary">{r.display_name}</span>
                          <TitleIcons titles={r.titles} />
                        </Link>
                      </td>
                      {allTime && <td className="hidden text-right font-mono text-sm text-base-content/60 md:table-cell">{r.seasons}</td>}
                      <td className="hidden text-right font-mono text-sm text-base-content/70 sm:table-cell">
                        {capped ? <>{r.counted}<span className="text-base-content/35">/{r.cashes}</span></> : r.cashes}
                      </td>
                      <td className="text-right font-mono text-sm">{r.wins || <span className="text-base-content/30">–</span>}</td>
                      <td className="hidden text-right font-mono text-sm sm:table-cell">{r.final_tables || <span className="text-base-content/30">–</span>}</td>
                      {allTime && <td className="hidden text-right font-mono text-sm md:table-cell">{gbp(r.money ?? 0)}</td>}
                      {prizes.length > 0 && (
                        <td className="hidden max-w-48 truncate text-sm text-base-content/70 lg:table-cell" title={prize?.prize_description}>
                          {prize ? prize.prize_description : ""}
                        </td>
                      )}
                      <td className="pr-6 text-right font-mono text-base font-semibold">{r.points.toFixed(2)}</td>
                    </tr>,
                    showPrizeLine ? (
                      <tr key={`line-${r.player_id}`} aria-hidden="true">
                        <td colSpan={9} className="p-0">
                          <div className="flex items-center gap-3 px-6 py-1.5">
                            <span className="h-px flex-1 bg-primary/50" />
                            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Prize places above</span>
                            <span className="h-px flex-1 bg-primary/50" />
                          </div>
                        </td>
                      </tr>
                    ) : null,
                  ];
                })}
                {!rows.length && (
                  <tr>
                    <td colSpan={9} className="py-14 text-center text-sm text-base-content/50">
                      {q ? "No player found. Only players who agreed to be named can be searched." : "No results yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Paging */}
          {pages > 1 && (
            <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-3 border-t border-base-content/[0.07] px-6 py-4 text-sm">
              <span className="text-base-content/55">
                {((page - 1) * PAGE_SIZE + 1).toLocaleString("en-GB")}–{Math.min(page * PAGE_SIZE, board.total).toLocaleString("en-GB")} of{" "}
                {board.total.toLocaleString("en-GB")}
              </span>
              <div className="flex items-center gap-1">
                <Link
                  href={href({ page: page > 2 ? String(page - 1) : undefined })}
                  aria-disabled={page <= 1}
                  className={`btn btn-ghost btn-sm btn-square ${page <= 1 ? "pointer-events-none opacity-30" : ""}`}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} />
                </Link>
                {pageList(page, pages).map((p, i) =>
                  p === 0 ? (
                    <span key={`gap-${i}`} className="px-1 text-base-content/35">…</span>
                  ) : (
                    <Link
                      key={p}
                      href={href({ page: p === 1 ? undefined : String(p) })}
                      aria-current={p === page ? "page" : undefined}
                      className={`btn btn-sm min-w-9 ${p === page ? "btn-primary" : "btn-ghost"}`}
                    >
                      {p}
                    </Link>
                  )
                )}
                <Link
                  href={href({ page: String(page + 1) })}
                  aria-disabled={page >= pages}
                  className={`btn btn-ghost btn-sm btn-square ${page >= pages ? "pointer-events-none opacity-30" : ""}`}
                  aria-label="Next page"
                >
                  <ChevronRight size={16} />
                </Link>
              </div>
            </nav>
          )}
        </section>
      </div>
    </>
  );
}

/** Page numbers to show: first, last, and two either side of the current one (0 = gap). */
function pageList(page: number, pages: number) {
  const set = new Set([1, pages, page - 2, page - 1, page, page + 1, page + 2].filter((p) => p >= 1 && p <= pages));
  const sorted = [...set].sort((a, b) => a - b);
  const out: number[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(0);
    out.push(p);
  });
  return out;
}
