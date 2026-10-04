// src/app/players/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { pageMeta } from "@/lib/site";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { decodeEntities } from "@/lib/nameMask";
import { type AllTimeSort, type TitleIcon, PAGE_SIZE, allTimeBoard, titlesFor } from "@/lib/leaderboards";
import TitleSeals from "@/components/badges/TitleSeals";
import { TitleBand } from "@/components/tournaments/ComingUp";
import { getSiteImages } from "@/lib/siteImages";
import PendingDot from "@/components/leaderboards/PendingDot";

export const metadata = pageMeta({ title: "Players", description: "Every player in the league, ranked by all-time points, wins and cashes.", path: "/players" });
export const revalidate = 300;

/** Every player ranks by all-time league points; any figure column can rank the list instead. */
const SORTS: { key: AllTimeSort; label: string; inSwitch?: boolean }[] = [
  { key: "points", label: "Points", inSwitch: true },
  { key: "wins", label: "Wins", inSwitch: true },
  { key: "cashes", label: "Cashes", inSwitch: true },
  { key: "final_tables", label: "Final tables" },
  { key: "seasons", label: "Seasons" },
];

/** A column heading that ranks the list by that column; the current one is marked and announced. */
function SortTh({ col, sort, href, className = "", children }: { col: AllTimeSort; sort: AllTimeSort; href: string; className?: string; children: React.ReactNode }) {
  const on = sort === col;
  return (
    <th scope="col" aria-sort={on ? "descending" : undefined} className={`pb-3 pl-5 text-right font-medium ${className}`}>
      <Link href={href} scroll={false} className={`inline-flex min-h-8 items-center gap-1 whitespace-nowrap transition-colors ${on ? "text-season-ink" : "hover:text-season-ink"}`}>
        {children}
        {on ? <ArrowDown size={13} strokeWidth={2.5} className="text-season-amber" aria-hidden="true" /> : null}
        <span className="sr-only">{on ? "(ranked by this)" : "(rank by this)"}</span>
      </Link>
    </th>
  );
}

function href(params: { q?: string; sort?: AllTimeSort; page?: number }) {
  const p = new URLSearchParams();
  if (params.q) p.set("q", params.q);
  if (params.sort && params.sort !== "points") p.set("sort", params.sort);
  if (params.page && params.page > 1) p.set("page", String(params.page));
  const s = p.toString();
  return `/players${s ? `?${s}` : ""}`;
}

export default async function PlayersPage(props: { searchParams: Promise<{ q?: string; page?: string; sort?: string }> }) {
  const img = await getSiteImages();
  const sp = await props.searchParams;
  const q = (sp.q || "").trim().slice(0, 60);
  const sort: AllTimeSort = SORTS.some((s) => s.key === sp.sort) ? (sp.sort as AllTimeSort) : "points";
  const page = Math.max(1, Number(sp.page) || 1);

  const db = await createSupabaseServerClient();
  let board: Awaited<ReturnType<typeof allTimeBoard>> | null = null;
  try {
    board = await allTimeBoard(db, "npl", sort, page, q || null);
  } catch (err) {
    console.error("[players] list failed", err);
  }
  const total = board?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Past the end of the list: go to the last page rather than showing an empty one.
  if (board && total > 0 && page > pages) redirect(href({ q, sort, page: pages }));
  // Every title each player holds (all seasons), shown as seals beside the name. Optional: the list stands without it.
  let titles = new Map<number, TitleIcon[]>();
  try {
    titles = await titlesFor(db, (board?.rows ?? []).map((r) => r.player_id), null);
  } catch (err) {
    console.error("[players] titles failed", err);
  }
  const rows = (board?.rows ?? []).map((r) => ({ ...r, display_name: decodeEntities(r.display_name), titles: titles.get(r.player_id) ?? [] }));
  const pageHref = (p: number) => `${href({ q, sort, page: p })}#list`;
  const sortLabel = SORTS.find((s) => s.key === sort)!.label.toLowerCase();

  return (
    <div className="bg-season-night font-season text-season-ink">
      <TitleBand image={img.players_hero} position="object-[72%_45%]">
        <h1 className="text-[clamp(2.5rem,4.4vw,4.375rem)] font-bold leading-[1.02] tracking-[-0.012em]">Players</h1>
        <p className="mt-2 text-[clamp(1.0625rem,1.45vw,1.375rem)] font-medium text-season-muted">
          {q ? (
            <>
              <span className="tabular-nums">{total.toLocaleString("en-GB")}</span> {total === 1 ? "player matches" : "players match"} “{q}”
            </>
          ) : (
            <>
              <span className="tabular-nums">{total.toLocaleString("en-GB")}</span> players, ranked by all-time points
            </>
          )}
        </p>
        <form action="/players" role="search" className="relative mt-6 w-full max-w-[34rem]">
          {sort !== "points" && <input type="hidden" name="sort" value={sort} />}
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-season-muted" aria-hidden="true" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Find a player"
            aria-label="Search players by name"
            enterKeyHint="search"
            autoComplete="off"
            className="h-12 w-full rounded-[3px] border border-white/[0.14] bg-season-night/70 pl-11 pr-4 text-[1rem] text-season-ink caret-season-amber placeholder:text-season-muted transition-colors hover:border-white/25 focus:border-season-amber/60 focus:outline-none focus-visible:outline-2 focus-visible:outline-season-amber"
          />
        </form>
      </TitleBand>

      <div className="px-4 pb-[clamp(2.5rem,4vw,4rem)] sm:px-[3.6vw]">
        <section id="list" aria-labelledby="list-heading" className="scroll-mt-6">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
            <div>
              <h2 id="list-heading" className="text-[clamp(1.3125rem,1.6vw,1.6875rem)] font-semibold leading-tight">
                {q ? `Players matching “${q}”` : `All-time, by ${sortLabel}`}
              </h2>
              <p className="mt-1 text-[0.9375rem] text-season-muted">Every result since records began counts.</p>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              {q && (
                <Link href={href({ sort })} className="inline-flex min-h-11 items-center text-[0.9375rem] font-medium text-season-amber hover:underline">
                  Clear search
                </Link>
              )}
              <nav aria-label="Rank players by" className="inline-flex rounded-[3px] border border-white/[0.12]">
                {SORTS.filter((s) => s.inSwitch).map((s) => (
                  <Link
                    key={s.key}
                    href={href({ q, sort: s.key })}
                    aria-current={sort === s.key ? "page" : undefined}
                    className={`-m-px flex h-11 items-center rounded-[3px] px-[1.1rem] text-[0.9375rem] font-medium transition-colors ${
                      sort === s.key ? "relative z-10 bg-season-amber/[0.12] font-semibold shadow-[inset_0_0_0_1px_var(--color-season-amber)]" : "text-season-ink/75 hover:text-season-ink"
                    }`}
                  >
                    {s.label}
                    <PendingDot />
                  </Link>
                ))}
              </nav>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full border-collapse text-left tabular-nums">
              <caption className="sr-only">Players ranked by all-time {sortLabel}, page {page} of {pages}</caption>
              <thead>
                <tr className="border-b border-white/[0.12] text-[0.875rem] text-season-muted">
                  <th scope="col" className="w-16 pb-3 pr-4 font-medium sm:w-20">Rank</th>
                  <th scope="col" className="w-full pb-3 font-medium">Player</th>
                  <SortTh col="seasons" sort={sort} href={`${href({ q, sort: "seasons" })}#list`} className="hidden lg:table-cell">Seasons</SortTh>
                  <SortTh col="cashes" sort={sort} href={`${href({ q, sort: "cashes" })}#list`} className="hidden sm:table-cell">Cashes</SortTh>
                  <SortTh col="wins" sort={sort} href={`${href({ q, sort: "wins" })}#list`} className="hidden sm:table-cell">Wins</SortTh>
                  <SortTh col="final_tables" sort={sort} href={`${href({ q, sort: "final_tables" })}#list`} className="hidden md:table-cell">Final tables</SortTh>
                  <SortTh col="points" sort={sort} href={`${href({ q, sort: "points" })}#list`}>
                    <span className="sm:hidden">{SORTS.find((s) => s.key === sort)!.label}</span>
                    <span className="hidden sm:inline">Points</span>
                  </SortTh>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const podium = r.position <= 3 && !q;
                  // Phones show one figure: the one the list is ranked by.
                  const mobileFigure = sort === "wins" ? r.wins : sort === "cashes" ? r.cashes : sort === "final_tables" ? r.final_tables : sort === "seasons" ? r.seasons : r.points.toFixed(2);
                  return (
                    <tr key={r.player_id} className="border-b border-white/[0.07] transition-colors hover:bg-white/[0.025]">
                      <td className={`pr-4 text-[1.0625rem] font-semibold ${podium ? "text-season-amber" : ""}`}>{r.position}</td>
                      <td className="max-w-0">
                        <Link href={`/players/${r.player_id}`} className="group flex min-h-14 min-w-0 items-center gap-3">
                          <span className={`min-w-0 truncate text-[1.0625rem] decoration-season-ink/40 underline-offset-4 group-hover:underline ${podium ? "font-semibold" : ""}`}>
                            {r.display_name}
                          </span>
                          <TitleSeals titles={r.titles} max={1} size={26} className="sm:hidden" />
                          <TitleSeals titles={r.titles} max={5} size={30} className="hidden sm:flex" />
                        </Link>
                      </td>
                      <td className={`hidden pl-5 text-right lg:table-cell ${sort === "seasons" ? "font-semibold" : "text-season-ink/80"}`}>{r.seasons}</td>
                      <td className={`hidden pl-5 text-right sm:table-cell ${sort === "cashes" ? "font-semibold" : "text-season-ink/80"}`}>{r.cashes}</td>
                      <td className={`hidden pl-5 text-right sm:table-cell ${sort === "wins" ? "font-semibold" : ""}`}>{r.wins || <span className="text-season-muted">–</span>}</td>
                      <td className={`hidden pl-5 text-right md:table-cell ${sort === "final_tables" ? "font-semibold" : ""}`}>{r.final_tables || <span className="text-season-muted">–</span>}</td>
                      <td className={`whitespace-nowrap pl-5 text-right text-[1.0625rem] font-semibold ${podium && sort === "points" ? "text-season-amber" : ""}`}>
                        <span className="sm:hidden">{mobileFigure}</span>
                        <span className="hidden sm:inline">{r.points.toFixed(2)}</span>
                      </td>
                    </tr>
                  );
                })}
                {!rows.length && (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-[1rem] text-season-ink/80">
                      {!board ? (
                        "Couldn't load the players this time. Please try again in a minute."
                      ) : q ? (
                        <>
                          No player matches “{q}”. Check the spelling or try just a surname.
                        </>
                      ) : (
                        "No players yet. They appear here after the first results update."
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
            <p className="text-[0.875rem] text-season-muted">Players who haven&apos;t agreed to show their name appear as initials and can&apos;t be found by searching.</p>
            {pages > 1 && (
              <nav aria-label="Pages" className="flex w-full items-center justify-between gap-4 sm:w-auto">
                <span className="text-[0.875rem] tabular-nums text-season-muted">
                  {((page - 1) * PAGE_SIZE + 1).toLocaleString("en-GB")}–{Math.min(page * PAGE_SIZE, total).toLocaleString("en-GB")} of {total.toLocaleString("en-GB")}
                </span>
                <div className="flex items-center gap-1">
                  <PagerArrow dir="prev" href={page > 1 ? pageHref(page - 1) : null} />
                  <span className="px-2 text-[0.9375rem] tabular-nums text-season-ink/80">Page {page.toLocaleString("en-GB")} of {pages.toLocaleString("en-GB")}</span>
                  <PagerArrow dir="next" href={page < pages ? pageHref(page + 1) : null} />
                </div>
              </nav>
            )}
          </div>
        </section>
      </div>
    </div>
  );
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
