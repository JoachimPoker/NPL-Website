import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Crown, Minus, Search, TrendingUp, Trophy, Zap } from "lucide-react";
import ShareButton from "@/components/ShareButton";
import TitleSeals from "@/components/badges/TitleSeals";
import { LEAGUE_MARKS } from "@/components/home/LeagueLeaders";
import RaceChart from "@/components/leaderboards/RaceChart";
import PendingDot from "@/components/leaderboards/PendingDot";
import { createSupabasePublicClient } from "@/lib/supabasePublic";
import { getSiteImages } from "@/lib/siteImages";
import {
  type BoardRow, type LeagueSlug, type Prize, type TitleIcon,
  PAGE_SIZE, allTimeBoard, formatRules, getLeagues, getSeasons, movementFor, prizesFor, seasonBoard, seasonRace, snapshots, thisWeek, titlesFor,
} from "@/lib/leaderboards";

export const dynamic = "force-dynamic";

type SP = { season?: string; league?: string; page?: string; q?: string };

// Every table ranks by points, the league's own measure. Winnings are not shown here at all (they live on
// player profiles): the league celebrates play, not money.
// Snapshot dates are plain YYYY-MM-DD; read them as UTC so they never shift a day.
const day = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const pts = (n: number) => Number(n).toFixed(2);
/** Short league names for the switch: "NPL", "High Roller", "Low Roller". */
const shortLeague = (slug: string, label: string) => (slug === "npl" ? "NPL" : label.replace(/\s+League$/i, ""));

/** Places moved since the last update: a drawn arrow and the count, never colour alone. */
function Movement({ move }: { move: number | null }) {
  if (move == null) return null;
  if (move === 0)
    return (
      <span className="inline-flex min-w-9 text-season-muted/70" title="No change since the last update">
        <Minus size={13} strokeWidth={2.25} aria-hidden="true" />
        <span className="sr-only">no change</span>
      </span>
    );
  const places = Math.abs(move) === 1 ? "place" : "places";
  const up = move > 0;
  const Arrow = up ? ArrowUp : ArrowDown;
  return (
    <span
      className={`inline-flex min-w-9 items-center gap-0.5 text-[0.8125rem] font-semibold tabular-nums ${up ? "text-season-up" : "text-season-down"}`}
      title={`${up ? "Up" : "Down"} ${Math.abs(move)} ${places} since the last update`}
    >
      <Arrow size={13} strokeWidth={2.5} aria-hidden="true" />
      <span aria-hidden="true">{Math.abs(move)}</span>
      <span className="sr-only">{up ? "up" : "down"} {Math.abs(move)} {places}</span>
    </span>
  );
}

/** A segmented switch (season or league): one row of links, the current one outlined in amber. */
function Switch({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-[0.9375rem] text-season-muted" aria-hidden="true">{label}</p>
      <nav aria-label={label} className="no-scrollbar relative -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="inline-flex rounded-[3px] border border-white/[0.12]">{children}</div>
      </nav>
    </div>
  );
}

function SwitchLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`-m-px flex h-11 shrink-0 items-center whitespace-nowrap rounded-[3px] px-[1.1rem] text-[0.9375rem] font-medium transition-colors ${
        active
          ? "relative z-10 bg-season-amber/[0.12] font-semibold text-season-ink shadow-[inset_0_0_0_1px_var(--color-season-amber)]"
          : "text-season-ink/75 hover:text-season-ink"
      }`}
    >
      {children}
      <PendingDot />
    </Link>
  );
}

export default async function LeaderboardsPage(props: { searchParams: Promise<SP> }) {
  const sp = await props.searchParams;
  const db = createSupabasePublicClient();

  const seasons = await getSeasons(db);
  const allTime = sp.season === "all";
  const season = allTime ? null : seasons.find((s) => String(s.year) === sp.season) ?? seasons.find((s) => s.is_active) ?? seasons[0] ?? null;
  const leagues = await getLeagues(db, season?.id ?? null);
  const league = leagues.find((l) => l.slug === sp.league) ?? leagues[0] ?? null;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q?.trim().slice(0, 60) || null;
  // A season or league asked for in the URL that doesn't exist falls back, and says so.
  const seasonMissing = !!sp.season && sp.season !== "all" && !seasons.some((s) => String(s.year) === sp.season);
  const leagueMissing = !!sp.league && !leagues.some((l) => l.slug === sp.league);

  const href = (patch: Partial<SP>) => {
    const next: SP = {
      season: allTime ? "all" : season && !season.is_active ? String(season.year) : undefined,
      league: league && league.slug !== "npl" ? league.slug : undefined,
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
      <div className="bg-season-night font-season text-season-ink">
        <Hero>
          <h1 className="text-[clamp(2rem,3vw,3.25rem)] font-bold leading-[1.04] tracking-[-0.01em]">Leaderboards</h1>
          <p className="mt-3 max-w-[32em] text-[clamp(1.0625rem,1.2vw,1.25rem)] text-season-ink/85">
            No leagues have been set up yet. Standings appear here after the first weekly results update.
          </p>
        </Hero>
      </div>
    );
  }

  // The table page, plus the (unfiltered) top of the table for the title card and race chart.
  // A failed load throws to error.tsx, so it is never mistaken for an empty league.
  const load = (p: number, search: string | null) =>
    (allTime ? allTimeBoard(db, league.slug, "points", p, search) : seasonBoard(db, league.id, p, search));
  const board = await load(page, q);
  // Past the end of the table: go to the last page rather than showing an empty one.
  if (board.total > 0 && page > Math.ceil(board.total / PAGE_SIZE)) {
    const last = Math.ceil(board.total / PAGE_SIZE);
    redirect(href({ page: last > 1 ? String(last) : undefined }));
  }
  const top = page === 1 && !q ? board.rows.slice(0, 5) : (await load(1, null)).rows.slice(0, 5);

  const ids = [...new Set([...board.rows, ...top].map((r) => r.player_id))];
  const current = !!season?.is_active;
  // Extras (titles, movement, prizes, race, freshness) degrade to nothing on failure; only the table itself is essential.
  const [titles, movement, prizes, race, snap] = await Promise.all([
    optional(titlesFor(db, ids, season?.year ?? null), new Map<number, TitleIcon[]>()),
    current && season ? optional(movementFor(db, season.id, league.slug as LeagueSlug, board.rows.map((r) => r.player_id)), new Map<number, number>()) : new Map<number, number>(),
    season ? optional(prizesFor(db, season.id, league.slug as LeagueSlug), [] as Prize[]) : ([] as Prize[]),
    season ? optional(seasonRace(db, season.id, league, top), null) : null,
    current && season ? optional(snapshots(db, season.id, league.slug as LeagueSlug), null) : null,
  ]);
  const withExtras = (r: BoardRow): BoardRow => ({ ...r, titles: titles.get(r.player_id) ?? [], movement: movement.get(r.player_id) ?? null });
  const rows = board.rows.map(withExtras);
  const names = new Map([...board.rows, ...top].map((r) => [r.player_id, r.display_name]));
  const week = current && season ? await optional(thisWeek(db, season.id, league.slug as LeagueSlug, names), []) : [];

  const pages = Math.max(1, Math.ceil(board.total / PAGE_SIZE));
  const lastPaid = prizes.length ? Math.max(...prizes.map((p) => p.position_to)) : null;
  const prizeFor = (pos: number) => prizes.find((p) => pos >= p.position_from && pos <= p.position_to) ?? null;
  const capped = !allTime && league.scoring_method === "capped";
  const seasonLabel = allTime ? "All-time" : `${season!.year} season`;
  const firstYear = seasons.length ? Math.min(...seasons.map((s) => s.year)) : undefined;
  const updatedTo = snap?.latest ? day(snap.latest) : null;
  const showRace = !q && !!race && race.dates.length > 1;
  // Paging keeps the reader at the table rather than the top of the page.
  const pageHref = (p: number | undefined) => `${href({ page: p && p > 1 ? String(p) : undefined })}#standings`;

  const [leader, second] = top;
  const gap = leader && second ? leader.points - second.points : null;
  const mark = LEAGUE_MARKS[league.slug];
  const logo = mark?.src ?? league.logo_url;
  const leadLine =
    gap == null
      ? null
      : allTime
        ? `${pts(gap)} points clear across every season`
        : current
          ? `${pts(gap)} points clear`
          : `Won the ${season!.year} season by ${pts(gap)} points`;

  return (
    <div className="bg-season-night font-season text-season-ink">
      {/* The title card: this league's leader, over a still of the room that dissolves into the page. */}
      <Hero>
        <h1 className="m-0">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={league.label} width={mark?.width} height={mark?.height} className="block h-6 w-auto" />
          ) : (
            <span className="block text-base font-bold uppercase tracking-wide">{league.label}</span>
          )}
          <span className="mt-2.5 block text-[clamp(1.0625rem,1.2vw,1.25rem)] font-medium text-season-ink/85">
            {seasonLabel}
            {updatedTo && <span className="text-season-ink/60"> · results up to {updatedTo}</span>}
          </span>
        </h1>
        {leader ? (
          <div className="mt-[clamp(0.75rem,1.4vw,1.25rem)]">
            <p className="flex flex-wrap items-center gap-x-3 text-[clamp(2rem,3vw,3.25rem)] font-bold leading-[1.04] tracking-[-0.012em]">
              {!current && !allTime && (
                <Crown className="size-[0.7em] text-season-amber" strokeWidth={2.25} aria-label={`${season!.year} champion`} role="img" />
              )}
              <Link href={`/players/${leader.player_id}`} className="[overflow-wrap:anywhere] hover:underline hover:decoration-season-ink/40 hover:underline-offset-[0.12em]">
                {leader.display_name}
              </Link>
            </p>
            <p className="mt-1 tabular-nums text-season-amber">
              <span className="text-[clamp(2rem,3vw,3.25rem)] font-bold leading-none">{pts(leader.points)}</span>
              <span className="ml-1.5 text-[clamp(1.125rem,1.5vw,1.5rem)] font-semibold">pts</span>
            </p>
            {leadLine && <p className="mt-3 text-[clamp(1.0625rem,1.2vw,1.25rem)] font-medium tabular-nums text-season-ink/90">{leadLine}</p>}
          </div>
        ) : (
          <p className="mt-4 max-w-[30em] text-[clamp(1.0625rem,1.2vw,1.25rem)] text-season-ink/85">
            No results in this league yet. Standings appear after the first weekly results update.
          </p>
        )}
      </Hero>

      <div className="px-4 pb-[clamp(2.5rem,4vw,4rem)] sm:px-[3.6vw]">
        {/* Controls: everything that changes what the table shows, in one row under the fade. */}
        <div className="grid gap-x-[clamp(1.5rem,3vw,3rem)] gap-y-5 lg:grid-cols-[auto_auto_minmax(16rem,1fr)] lg:items-end">
          <Switch label="Season">
            {seasons.map((s) => (
              <SwitchLink key={s.id} href={href({ season: s.is_active ? undefined : String(s.year) })} active={!allTime && season?.id === s.id}>
                {s.year}
              </SwitchLink>
            ))}
            <SwitchLink href={href({ season: "all" })} active={allTime}>
              All-time
            </SwitchLink>
          </Switch>

          <Switch label="League">
            {leagues.map((l) => (
              <SwitchLink key={l.slug} href={href({ league: l.slug === "npl" ? undefined : l.slug })} active={l.slug === league.slug}>
                {shortLeague(l.slug, l.label)}
              </SwitchLink>
            ))}
          </Switch>

          <form id="find" action="/leaderboards#standings" className="relative w-full scroll-mt-8" role="search">
            {allTime && <input type="hidden" name="season" value="all" />}
            {!allTime && season && !season.is_active && <input type="hidden" name="season" value={season.year} />}
            {league.slug !== "npl" && <input type="hidden" name="league" value={league.slug} />}
            <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-season-muted" aria-hidden="true" />
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Find my standing"
              aria-label="Search players by name"
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              className="h-12 w-full rounded-[3px] border border-white/[0.12] bg-season-card/70 pl-11 pr-4 text-[1rem] text-season-ink caret-season-amber placeholder:text-season-muted transition-colors hover:border-white/25 focus:border-season-amber/60 focus:outline-none focus-visible:outline-2 focus-visible:outline-season-amber"
            />
          </form>
        </div>

        {(seasonMissing || leagueMissing) && (
          <p className="mt-5 text-[0.9375rem] text-season-ink/80" role="status">
            {seasonMissing && `There's no ${sp.season} season, so this is ${allTime ? "the all-time table" : `the ${season?.year} season`}. `}
            {leagueMissing && `That league isn't running ${allTime ? "here" : `in ${season?.year}`}, so this is the ${league.label}.`}
          </p>
        )}

        {/* The standings */}
        <section id="standings" className="mt-[clamp(2.25rem,3.5vw,3.25rem)] scroll-mt-6" aria-labelledby="table-heading">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div className="min-w-0">
              <h2 id="table-heading" className="break-words text-[clamp(1.3125rem,1.6vw,1.6875rem)] font-semibold leading-tight">
                {q ? `Players matching “${q}”` : `${board.total.toLocaleString("en-GB")} ${board.total === 1 ? "player" : "players"}`}
              </h2>
              <p className="mt-1 text-[0.9375rem] text-season-muted">
                {formatRules(league, allTime, firstYear)}
                {season && !prizes.length && <> · Prize places not published for this season</>}
              </p>
            </div>
            <div className="flex items-center gap-x-5">
              {pages > 1 && (
                <a href="#pages" className="sr-only focus:not-sr-only focus:text-[0.9375rem] focus:text-season-amber">
                  Skip to page navigation
                </a>
              )}
              {q && (
                <Link href={href({ q: undefined })} className="inline-flex min-h-11 items-center text-[0.9375rem] font-medium text-season-amber hover:underline">
                  Clear search
                </Link>
              )}
              <ShareButton
                title={`NPL ${allTime ? "all-time" : seasonLabel} leaderboard`}
                className="inline-flex h-11 items-center gap-2 rounded-[3px] border border-white/[0.14] px-4 text-[0.9375rem] font-medium text-season-ink transition-colors hover:border-white/30"
              />
            </div>
          </div>

          {/* Phones keep # · Player · Points; the other columns join from sm and lg up. */}
          <div className="mt-5 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">
                {league.label}, {seasonLabel}, {q ? `players matching ${q}` : `page ${page} of ${pages}`}
              </caption>
              <thead>
                <tr className="border-b border-white/[0.12] text-[0.875rem] text-season-muted">
                  <th scope="col" className="w-16 pb-3 pr-3 font-medium sm:w-28">Rank</th>
                  <th scope="col" className="w-full pb-3 font-medium">Player</th>
                  {allTime && <th scope="col" className="hidden pb-3 pl-6 text-right font-medium lg:table-cell">Seasons</th>}
                  <th scope="col" className="hidden pb-3 pl-6 text-right font-medium sm:table-cell" title={capped ? "Results that score, out of all cashes" : undefined}>
                    {capped ? "Counted" : "Cashes"}
                  </th>
                  <th scope="col" className="hidden pb-3 pl-6 text-right font-medium sm:table-cell">Wins</th>
                  <th scope="col" className="hidden whitespace-nowrap pb-3 pl-6 text-right font-medium md:table-cell">Final tables</th>
                  {prizes.length > 0 && <th scope="col" className="hidden pb-3 pl-6 font-medium xl:table-cell">Prize</th>}
                  <th scope="col" className="pb-3 pl-6 text-right font-medium">Points</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const prize = prizeFor(r.position);
                  const next = rows[i + 1];
                  const showPrizeLine = lastPaid != null && r.position === lastPaid && next;
                  const podium = r.position <= 3;
                  return [
                    <tr key={r.player_id} className="border-b border-white/[0.07] transition-colors hover:bg-white/[0.025]">
                      <td className="py-1 pr-3 sm:py-0">
                        <span className="flex flex-col items-start gap-0.5 sm:flex-row sm:items-center sm:gap-3">
                          <span className={`w-7 text-[1.0625rem] font-semibold tabular-nums sm:text-lg ${podium ? "text-season-amber" : "text-season-ink"}`}>{r.position}</span>
                          <Movement move={r.movement} />
                        </span>
                        {prize && <span className="sr-only">, in the prize places</span>}
                      </td>
                      {/* max-w-0 lets the name truncate inside an auto-width table instead of widening it. */}
                      <td className="max-w-0">
                        <Link href={`/players/${r.player_id}`} className="group flex min-h-14 min-w-0 items-center gap-3 sm:min-h-[3.75rem]">
                          <span
                            className={`min-w-0 truncate text-[1.0625rem] decoration-season-ink/40 underline-offset-4 group-hover:underline sm:text-lg ${podium ? "font-semibold" : "font-normal"}`}
                          >
                            {r.display_name}
                          </span>
                          <TitleSeals titles={r.titles} max={1} size={26} className="sm:hidden" />
                          <TitleSeals titles={r.titles} max={4} size={30} className="hidden sm:flex" />
                        </Link>
                      </td>
                      {allTime && <td className="hidden pl-6 text-right tabular-nums text-season-ink/80 lg:table-cell">{r.seasons}</td>}
                      <td className="hidden pl-6 text-right tabular-nums text-season-ink/80 sm:table-cell">
                        {capped ? <>{r.counted}<span className="text-season-muted">/{r.cashes}</span></> : r.cashes}
                      </td>
                      <td className="hidden pl-6 text-right tabular-nums sm:table-cell">{r.wins || <span className="text-season-muted">–</span>}</td>
                      <td className="hidden pl-6 text-right tabular-nums md:table-cell">{r.final_tables || <span className="text-season-muted">–</span>}</td>
                      {prizes.length > 0 && (
                        <td className="hidden max-w-48 truncate pl-6 text-[0.9375rem] text-season-ink/75 xl:table-cell" title={prize?.prize_description}>
                          {prize ? prize.prize_description : ""}
                        </td>
                      )}
                      <td className={`whitespace-nowrap pl-6 text-right text-[1.0625rem] font-semibold tabular-nums sm:text-lg ${podium ? "text-season-amber" : "text-season-ink"}`}>
                        {pts(r.points)}
                      </td>
                    </tr>,
                    showPrizeLine ? (
                      <tr key={`line-${r.player_id}`}>
                        <td colSpan={9} className="p-0">
                          <div className="flex items-center gap-3 py-2">
                            <span className="h-px flex-1 bg-season-amber/50" aria-hidden="true" />
                            <span className="text-[0.875rem] font-medium text-season-amber">Prize places above</span>
                            <span className="h-px flex-1 bg-season-amber/50" aria-hidden="true" />
                          </div>
                        </td>
                      </tr>
                    ) : null,
                  ];
                })}
                {!rows.length && (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-[1rem] text-season-ink/80">
                      {q ? (
                        <>
                          No player matches “{q}”. Check the spelling or try just a surname.
                          <span className="mt-1 block text-season-muted">Players who haven’t agreed to be named are shown by initials and can’t be searched.</span>
                        </>
                      ) : (
                        "No results in this league yet. Standings appear after the first weekly results update."
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Key for the shorthand, then paging */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
            <p className="text-[0.875rem] text-season-muted">
              {movement.size > 0 && <>Arrows show places moved since the last update. </>}
              {capped && <span className="hidden sm:inline">Counted: results that score, out of all cashes.</span>}
            </p>
            {pages > 1 && (
              <nav id="pages" aria-label="Pages" className="flex w-full items-center justify-between gap-4 sm:w-auto sm:justify-end">
                <span className="hidden text-[0.875rem] tabular-nums text-season-muted md:inline">
                  {((page - 1) * PAGE_SIZE + 1).toLocaleString("en-GB")}–{Math.min(page * PAGE_SIZE, board.total).toLocaleString("en-GB")} of{" "}
                  {board.total.toLocaleString("en-GB")}
                </span>
                <div className="flex w-full items-center justify-between gap-1 sm:w-auto">
                  <PagerArrow dir="prev" href={page > 1 ? pageHref(page - 1) : null} />
                  {/* Phones: one line of context instead of a row of small page buttons. */}
                  <span className="text-[0.9375rem] tabular-nums text-season-ink/80 sm:hidden">
                    Page {page.toLocaleString("en-GB")} of {pages.toLocaleString("en-GB")}
                  </span>
                  {pageList(page, pages).map((p, i) =>
                    p === 0 ? (
                      <span key={`gap-${i}`} className="hidden px-1 text-season-muted sm:inline">…</span>
                    ) : (
                      <Link
                        key={p}
                        href={pageHref(p)}
                        aria-current={p === page ? "page" : undefined}
                        className={`relative hidden h-10 min-w-10 items-center justify-center rounded-[3px] px-2 text-[0.9375rem] tabular-nums transition-colors sm:inline-flex ${
                          p === page ? "font-semibold text-season-ink shadow-[inset_0_0_0_1px_var(--color-season-amber)]" : "text-season-ink/75 hover:bg-white/[0.06] hover:text-season-ink"
                        }`}
                      >
                        {p}
                        <PendingDot corner />
                      </Link>
                    )
                  )}
                  <PagerArrow dir="next" href={page < pages ? pageHref(page + 1) : null} />
                </div>
              </nav>
            )}
          </div>
        </section>

        {/* The season so far: the race at the top, and who moved since the last update. */}
        {(showRace || week.length > 0) && (
          <div className={`mt-[clamp(3rem,5vw,5rem)] grid items-start gap-x-[clamp(2rem,4vw,4rem)] gap-y-12 ${showRace && week.length > 0 ? "lg:grid-cols-[minmax(0,1fr)_22rem]" : ""}`}>
            {showRace && (
              <section aria-labelledby="race-heading" className="min-w-0">
                <h2 id="race-heading" className="text-[clamp(1.3125rem,1.6vw,1.6875rem)] font-semibold leading-tight">The race</h2>
                <p className="mt-1 text-[0.9375rem] text-season-muted">How the top five&apos;s points built up through the season.</p>
                <div className="mt-5 border border-white/[0.08] bg-[linear-gradient(180deg,#14434a_0%,#0f3337_55%)] p-3 sm:p-5">
                  <RaceChart series={race!} />
                </div>
              </section>
            )}

            {week.length > 0 && (
              <section aria-labelledby="week-heading">
                <h2 id="week-heading" className="text-[clamp(1.3125rem,1.6vw,1.6875rem)] font-semibold leading-tight">Since the last update</h2>
                {updatedTo && <p className="mt-1 text-[0.9375rem] text-season-muted">Results up to {updatedTo}</p>}
                <ul className="mt-5 border-t border-white/[0.08]">
                  {week.map((w) => {
                    const Icon = w.label.startsWith("Biggest") ? TrendingUp : w.label.startsWith("New") ? Trophy : Zap;
                    return (
                      <li key={w.label} className="border-b border-white/[0.08]">
                        <Link href={`/players/${w.player_id}`} className="group flex items-center gap-4 py-4">
                          <Icon size={20} strokeWidth={2} className="shrink-0 text-season-amber" aria-hidden="true" />
                          <span className="min-w-0">
                            <span className="block text-[0.9375rem] text-season-muted">{w.label}</span>
                            <span className="block truncate text-[1.0625rem] font-semibold decoration-season-ink/40 underline-offset-4 group-hover:underline">{w.name}</span>
                            <span className="block text-[0.9375rem] text-season-ink/80">{w.detail}</span>
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
      </div>
    </div>
  );
}

/**
 * The page's opening still: a tournament hall under its lamps, falling away into the page ground with no edge.
 * The photo is a generated stand-in (no real people); swap in real event photography.
 */
async function Hero({ children }: { children: React.ReactNode }) {
  const img = await getSiteImages();
  return (
    <section className="relative isolate flex min-h-[clamp(22rem,27vw,29rem)] items-end overflow-hidden">
      {/* The photo starts under the header bar, so its lamps never sit behind the nav; it fades in from the night ground. */}
      <div className="absolute inset-x-0 bottom-0 top-[3.5rem] -z-10">
        <Image src={img.leaderboards_hero} alt="" fill priority sizes="100vw" className="object-cover object-[70%_50%]" />
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-season-night to-transparent" />
      </div>
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-[75%] bg-gradient-to-t from-season-night from-10% via-season-night/75 via-50% to-transparent" />
      <div aria-hidden="true" className="absolute inset-y-0 left-0 -z-10 w-full bg-gradient-to-r from-season-night/85 via-season-night/40 to-transparent sm:w-[65%]" />
      {/* Clear of the transparent site header above. */}
      <div className="rise w-full px-4 pb-[clamp(2.25rem,3.5vw,3.5rem)] pt-[7.5rem] sm:px-[3.6vw]">{children}</div>
    </section>
  );
}

/** Resolve to a fallback instead of failing the whole page (the failure is still logged). */
async function optional<T>(work: Promise<T>, fallback: T): Promise<T> {
  try {
    return await work;
  } catch (err) {
    console.error("[leaderboards] optional data failed", err);
    return fallback;
  }
}

/** Previous / next page. At either end it is a plain disabled control, not a focusable dead link. */
function PagerArrow({ dir, href }: { dir: "prev" | "next"; href: string | null }) {
  const label = dir === "prev" ? "Previous page" : "Next page";
  const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
  const cls = "relative inline-flex size-11 items-center justify-center rounded-[3px] text-season-ink transition-colors sm:size-10";
  if (!href)
    return (
      <span className={`${cls} pointer-events-none opacity-30`} aria-disabled="true" aria-label={label} role="link">
        <Icon size={18} aria-hidden="true" />
      </span>
    );
  return (
    <Link href={href} className={`${cls} hover:bg-white/[0.06]`} aria-label={label}>
      <Icon size={18} aria-hidden="true" />
      <PendingDot corner />
    </Link>
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
