import Link from "next/link";
import { pageMeta } from "@/lib/site";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { getUpcoming } from "@/lib/venues";
import { decodeEntities } from "@/lib/nameMask";
import { createSupabasePublicClient } from "@/lib/supabasePublic";
import { type EventSummary, type FestivalSummary, type SeriesRow, day, eventHref } from "@/lib/tournaments";
import { ComingUp, TitleBand } from "@/components/tournaments/ComingUp";
import { getSiteImages } from "@/lib/siteImages";
import { EventRows, FestivalStrip, eventTitle } from "@/components/tournaments/SeasonCalendar";

export const runtime = "nodejs";
export const revalidate = 300;

type LbRow = {
  position: number;
  player_id: number;
  display_name: string;
  total_points: number;
  events_played: number;
  wins: number;
  final_tables: number;
};

const h2 = "text-[clamp(1.5rem,1.9vw,2rem)] font-semibold leading-tight";
const PAGE_SIZE = 25;

/** Series pages live at /events/<slug>; old numeric links (/events/12) still work. */
async function findSeries(param: string) {
  const supabase = createSupabasePublicClient();
  const cols = "*";
  const bySlug = await supabase.from("series").select(cols).eq("slug", param).maybeSingle();
  if (bySlug.data) return bySlug.data as SeriesRow;
  if (/^\d+$/.test(param)) {
    const byId = await supabase.from("series").select(cols).eq("id", Number(param)).maybeSingle();
    return (byId.data as SeriesRow) ?? null;
  }
  return null;
}

export async function generateMetadata(props: { params: Promise<{ seriesId: string }> }): Promise<Metadata> {
  const s = await findSeries((await props.params).seriesId);
  if (!s) return { title: "Series" };
  return pageMeta({ title: s.name, description: s.description ?? `${s.name} standings, champions and festival results.`, path: `/events/${s.slug ?? s.id}` });
}

/** The whole series table: the API returns at most 1,000 rows per request, so read it in pages. */
async function allSeriesRows(supabase: Awaited<ReturnType<typeof createSupabasePublicClient>>, seriesId: number, scope: string) {
  const rows: LbRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .rpc("leaderboard_for_series", { p_series_id: seriesId, p_scope: scope })
      .order("position")
      .order("player_id") // stable across pages when positions tie
      .range(from, from + 999);
    if (error) return { data: rows.length ? rows : null, error };
    rows.push(...((data || []) as LbRow[]));
    if (!data || data.length < 1000) return { data: rows, error: null };
  }
}

export default async function SeriesPage(props: {
  params: Promise<{ seriesId: string }>;
  searchParams: Promise<{ scope?: string; page?: string }>;
}) {
  const img = await getSiteImages();
  const params = await props.params;
  const sp = await props.searchParams;
  const series = await findSeries(params.seriesId);
  if (!series) notFound();

  const scope = sp.scope === "all_time" ? "all_time" : "season";
  const supabase = createSupabasePublicClient();
  const { data: activeSeason } = await supabase.from("seasons").select("id, name, year").eq("is_active", true).maybeSingle();

  const [{ data: lbRows, error: lbError }, { data: eventData }, { data: festivalData }, upcoming] = await Promise.all([
    allSeriesRows(supabase, series.id, scope),
    supabase.from("event_summary").select("*").eq("series_id", series.id).order("start_date", { ascending: false }).limit(400),
    supabase.from("festival_summary").select("*").eq("series_id", series.id).order("start_date", { ascending: false }).limit(12),
    getUpcoming({ seriesId: series.id, limit: 4 }),
  ]);
  if (lbError) console.error("Series leaderboard error:", lbError);

  const allRows = ((lbRows || []) as LbRow[]).map((r) => ({ ...r, display_name: decodeEntities(r.display_name) }));
  const events = (eventData || []) as EventSummary[];
  const festivals = (festivalData || []) as FestivalSummary[];
  const seasonEvents = events.filter((e) => e.season_id === activeSeason?.id);
  const seasonFestivals = festivals.filter((f) => f.season_id === activeSeason?.id);
  const seriesById = new Map([[series.id, series]]);

  const pages = Math.max(1, Math.ceil(allRows.length / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number(sp.page) || 1));
  const rows = allRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const href = (patch: { scope?: string; page?: number }) => {
    const q = new URLSearchParams();
    const sc = patch.scope ?? scope;
    if (sc === "all_time") q.set("scope", "all_time");
    if (patch.page && patch.page > 1) q.set("page", String(patch.page));
    const s = q.toString();
    return s ? `?${s}` : "?";
  };

  const records = [
    { label: "Most wins", row: [...allRows].sort((a, b) => b.wins - a.wins)[0], value: (r: LbRow) => r.wins },
    { label: "Most final tables", row: [...allRows].sort((a, b) => b.final_tables - a.final_tables)[0], value: (r: LbRow) => r.final_tables },
    { label: "Most events", row: [...allRows].sort((a, b) => b.events_played - a.events_played)[0], value: (r: LbRow) => r.events_played },
  ].filter((r) => r.row && r.value(r.row) > 0);

  return (
    <div className="bg-season-night font-season text-season-ink">
      <TitleBand image={series.image_url || img.room_3} position="object-[60%_55%]">
        <Link href="/events" className="mb-5 inline-flex min-h-11 items-center gap-1.5 text-[0.9375rem] font-medium text-season-ink/75 hover:text-season-ink">
          <ArrowLeft size={16} strokeWidth={2.25} aria-hidden="true" /> Tournaments
        </Link>
        <h1 className="m-0">
          {series.logo_url ? (
            // The logo is the title; its alt text carries the name.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={series.logo_url} alt={series.name} className="block h-[clamp(3.5rem,6vw,5.5rem)] w-auto max-w-full object-contain object-left" />
          ) : (
            <span className="block text-[clamp(2.5rem,4.4vw,4.375rem)] font-bold leading-[1.02] tracking-[-0.012em]">{series.name}</span>
          )}
        </h1>
        {series.description && <p className="mt-4 max-w-[38em] text-[clamp(1.0625rem,1.25vw,1.25rem)] leading-relaxed text-season-ink/85">{series.description}</p>}
        <p className="mt-3 text-[1.0625rem] font-medium tabular-nums text-season-ink/80">
          {activeSeason && (
            <>
              {activeSeason.year}: {seasonEvents.length} {seasonEvents.length === 1 ? "event" : "events"}
              {seasonFestivals.length > 0 && ` · ${seasonFestivals.length} ${seasonFestivals.length === 1 ? "festival" : "festivals"}`}
            </>
          )}
          {events[0] && <span className="text-season-ink/60">{activeSeason ? " · " : ""}last event {day(events[0].start_date, { day: "numeric", month: "short", year: "numeric" })}</span>}
        </p>
      </TitleBand>

      <div className="space-y-[clamp(2.5rem,4vw,4rem)] px-4 pb-[clamp(2.5rem,4vw,4rem)] sm:px-[3.6vw]">
        <ComingUp items={upcoming} seriesById={seriesById} title={`Next ${series.name} dates`} />

        <div className="grid gap-x-[clamp(2rem,4vw,4.5rem)] gap-y-14 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          {/* Standings */}
          <section id="standings" aria-labelledby="series-standings" className="min-w-0 scroll-mt-8">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
              <div>
                <h2 id="series-standings" className={h2}>Standings</h2>
                <p className="mt-1 text-[0.9375rem] tabular-nums text-season-muted">
                  {allRows.length.toLocaleString("en-GB")} {allRows.length === 1 ? "player" : "players"} · {scope === "season" ? `the ${activeSeason?.year ?? "current"} season` : "every season"}
                </p>
              </div>
              <nav aria-label="Standings period" className="inline-flex rounded-[3px] border border-white/[0.12]">
                {[
                  { key: "season", label: "This season" },
                  { key: "all_time", label: "All-time" },
                ].map((o) => (
                  <Link
                    key={o.key}
                    href={`${href({ scope: o.key, page: 1 })}#standings`}
                    scroll={false}
                    aria-current={scope === o.key ? "page" : undefined}
                    className={`-m-px flex h-11 items-center rounded-[3px] px-[1.1rem] text-[0.9375rem] font-medium transition-colors ${
                      scope === o.key ? "relative z-10 bg-season-amber/[0.12] font-semibold shadow-[inset_0_0_0_1px_var(--color-season-amber)]" : "text-season-ink/75 hover:text-season-ink"
                    }`}
                  >
                    {o.label}
                  </Link>
                ))}
              </nav>
            </div>

            {!rows.length ? (
              <p className="mt-6 border-t border-white/[0.12] py-14 text-center text-season-ink/80">
                {scope === "season" ? "Nothing has been recorded for this series this season." : "Nothing has been recorded for this series yet."}
              </p>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full border-collapse text-left tabular-nums">
                  <caption className="sr-only">{series.name} standings, {scope === "season" ? "this season" : "all-time"}, page {page} of {pages}</caption>
                  <thead>
                    <tr className="border-b border-white/[0.12] text-[0.875rem] text-season-muted">
                      <th scope="col" className="w-16 pb-3 pr-3 font-medium">Rank</th>
                      <th scope="col" className="w-full pb-3 font-medium">Player</th>
                      <th scope="col" className="hidden pb-3 pl-5 text-right font-medium sm:table-cell">Events</th>
                      <th scope="col" className="hidden pb-3 pl-5 text-right font-medium sm:table-cell">Wins</th>
                      <th scope="col" className="hidden whitespace-nowrap pb-3 pl-5 text-right font-medium md:table-cell">Final tables</th>
                      <th scope="col" className="pb-3 pl-5 text-right font-medium">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const podium = r.position <= 3;
                      return (
                        <tr key={r.player_id} className="border-b border-white/[0.07] transition-colors hover:bg-white/[0.025]">
                          <td className={`pr-3 text-[1.0625rem] font-semibold ${podium ? "text-season-amber" : ""}`}>{r.position}</td>
                          <td className="max-w-0">
                            <Link href={`/players/${r.player_id}`} className={`block min-h-14 truncate py-4 text-[1.0625rem] decoration-season-ink/40 underline-offset-4 hover:underline ${podium ? "font-semibold" : ""}`}>
                              {r.display_name}
                            </Link>
                          </td>
                          <td className="hidden pl-5 text-right text-season-ink/80 sm:table-cell">{r.events_played}</td>
                          <td className="hidden pl-5 text-right sm:table-cell">{r.wins || <span className="text-season-muted">–</span>}</td>
                          <td className="hidden pl-5 text-right md:table-cell">{r.final_tables || <span className="text-season-muted">–</span>}</td>
                          <td className={`whitespace-nowrap pl-5 text-right text-[1.0625rem] font-semibold ${podium ? "text-season-amber" : ""}`}>{Number(r.total_points).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {pages > 1 && (
              <nav aria-label="Pages" className="mt-4 flex items-center justify-between gap-4">
                <span className="text-[0.875rem] tabular-nums text-season-muted">
                  {((page - 1) * PAGE_SIZE + 1).toLocaleString("en-GB")}–{Math.min(page * PAGE_SIZE, allRows.length).toLocaleString("en-GB")} of {allRows.length.toLocaleString("en-GB")}
                </span>
                <div className="flex items-center gap-1">
                  <PagerArrow dir="prev" href={page > 1 ? `${href({ page: page - 1 })}#standings` : null} />
                  <span className="px-2 text-[0.9375rem] tabular-nums text-season-ink/80">Page {page} of {pages}</span>
                  <PagerArrow dir="next" href={page < pages ? `${href({ page: page + 1 })}#standings` : null} />
                </div>
              </nav>
            )}
          </section>

          {/* Champions and records */}
          <aside className="min-w-0 space-y-12" aria-label={`${series.name} champions and records`}>
            <section aria-labelledby="champions">
              <h2 id="champions" className="text-[clamp(1.3125rem,1.6vw,1.6875rem)] font-semibold leading-tight">Latest champions</h2>
              {events.length > 0 ? (
                <ol className="mt-5 border-t border-white/[0.12]">
                  {events.slice(0, 6).map((e) => (
                    <li key={e.id} className="border-b border-white/[0.07]">
                      <Link href={eventHref(e.id)} className="group block py-3.5">
                        <span className="block truncate text-[1.0625rem] font-semibold text-season-amber">{e.winner_name ?? "–"}</span>
                        <span className="block truncate text-[0.9375rem] decoration-season-ink/40 underline-offset-4 group-hover:underline" title={e.name ?? ""}>{eventTitle(e.name)}</span>
                        <span className="block text-[0.875rem] tabular-nums text-season-muted">{day(e.start_date, { day: "numeric", month: "short", year: "numeric" })}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-4 text-season-ink/80">No winners recorded yet.</p>
              )}
            </section>

            {records.length > 0 && (
              <section aria-labelledby="records">
                <h2 id="records" className="text-[clamp(1.3125rem,1.6vw,1.6875rem)] font-semibold leading-tight">Record holders</h2>
                <p className="mt-1 text-[0.9375rem] text-season-muted">{scope === "season" ? "This season" : "All-time"}</p>
                <dl className="mt-4 border-t border-white/[0.12]">
                  {records.map(({ label, row, value }) => (
                    <div key={label} className="flex items-center justify-between gap-4 border-b border-white/[0.07] py-3.5">
                      <div className="min-w-0">
                        <dt className="text-[0.9375rem] text-season-muted">{label}</dt>
                        <dd className="truncate text-[1.0625rem] font-semibold">
                          <Link href={`/players/${row!.player_id}`} className="decoration-season-ink/40 underline-offset-4 hover:underline">{row!.display_name}</Link>
                        </dd>
                      </div>
                      <dd className="shrink-0 text-[1.75rem] font-bold tabular-nums text-season-amber">{value(row!)}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </aside>
        </div>

        {/* Festivals, or recent events for single-event series */}
        {series.has_festivals && festivals.length > 0 ? (
          <section aria-labelledby="series-festivals">
            <h2 id="series-festivals" className={h2}>Festivals</h2>
            <div className="mt-5 space-y-4">
              {festivals.map((f, i) => <FestivalStrip key={f.id} festival={f} series={series} still={i} badge={false} />)}
            </div>
          </section>
        ) : events.length > 0 ? (
          <section aria-labelledby="series-events">
            <h2 id="series-events" className={h2}>Recent events</h2>
            <EventRows events={events.slice(0, 15)} badge={false} year className="mt-5 border-t border-white/[0.12]" />
          </section>
        ) : null}
      </div>
    </div>
  );
}

/** Previous / next page. At either end it is a plain disabled control, not a focusable dead link. */
function PagerArrow({ dir, href }: { dir: "prev" | "next"; href: string | null }) {
  const label = dir === "prev" ? "Previous page" : "Next page";
  const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
  const cls = "inline-flex size-11 items-center justify-center rounded-[3px] text-season-ink transition-colors sm:size-10";
  if (!href)
    return (
      <span className={`${cls} pointer-events-none opacity-30`} aria-disabled="true" aria-label={label} role="link">
        <Icon size={18} aria-hidden="true" />
      </span>
    );
  return (
    <Link href={href} scroll={false} className={`${cls} hover:bg-white/[0.06]`} aria-label={label}>
      <Icon size={18} aria-hidden="true" />
    </Link>
  );
}
