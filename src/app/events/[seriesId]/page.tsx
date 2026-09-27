import Link from "next/link";
import { pageMeta } from "@/lib/site";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Trophy } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import UpcomingList from "@/components/tournaments/UpcomingList";
import { getUpcoming } from "@/lib/venues";
import { Initial } from "@/components/HomeLeaderboard";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { SeriesMark, FestivalCard, ResultCard } from "@/components/tournaments/TournamentCards";
import { type EventSummary, type FestivalSummary, type SeriesRow, gbpShort, day, eventHref } from "@/lib/tournaments";

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

/** Series pages live at /events/<slug>; old numeric links (/events/12) still work. */
async function findSeries(param: string) {
  const supabase = await createSupabaseServerClient();
  const cols = "id, name, slug, description, logo_url, has_festivals, sort_order";
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
async function allSeriesRows(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, seriesId: number, scope: string) {
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
  const params = await props.params;
  const sp = await props.searchParams;
  const series = await findSeries(params.seriesId);
  if (!series) notFound();

  const scope = sp.scope === "all_time" ? "all_time" : "season";
  const currentPage = Math.max(1, Number(sp.page || 1));
  const pageSize = 50;
  const supabase = await createSupabaseServerClient();

  const { data: activeSeason } = await supabase.from("seasons").select("id, name").eq("is_active", true).maybeSingle();

  const [{ data: lbRows, error: lbError }, { data: eventData }, { data: festivalData }, upcoming] = await Promise.all([
    allSeriesRows(supabase, series.id, scope),
    supabase.from("event_summary").select("*").eq("series_id", series.id).order("start_date", { ascending: false }).limit(400),
    supabase.from("festival_summary").select("*").eq("series_id", series.id).order("start_date", { ascending: false }).limit(12),
    getUpcoming({ seriesId: series.id }),
  ]);
  if (lbError) console.error("Series leaderboard error:", lbError);

  const allRows = (lbRows || []) as LbRow[];
  const events = (eventData || []) as EventSummary[];
  const festivals = (festivalData || []) as FestivalSummary[];
  const seasonEvents = events.filter((e) => e.season_id === activeSeason?.id);

  const mostWins = [...allRows].sort((a, b) => b.wins - a.wins)[0];
  const mostFts = [...allRows].sort((a, b) => b.final_tables - a.final_tables)[0];
  const mostEvents = [...allRows].sort((a, b) => b.events_played - a.events_played)[0];

  const totalPlayers = allRows.length;
  const totalPages = Math.ceil(totalPlayers / pageSize);
  const paginatedRows = allRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/events" className="hover:text-primary">Tournaments</Link>}
        title={
          series.logo_url ? (
            // The logo is the title; its alt text carries the name.
            <SeriesMark series={series} size="lg" />
          ) : (
            <span className="flex items-center gap-4">
              <SeriesMark series={series} size="lg" />
              {series.name}
            </span>
          )
        }
        description={series.description || undefined}
        actions={
          <div role="tablist" aria-label="Standings period" className="inline-flex rounded-lg bg-base-100 p-1 ring-1 ring-inset ring-base-content/[0.07]">
            {[
              { key: "season", label: "This season" },
              { key: "all_time", label: "All-time" },
            ].map((o) => (
              <Link
                key={o.key}
                href={`?scope=${o.key}`}
                role="tab"
                aria-selected={scope === o.key}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                  scope === o.key ? "bg-primary text-primary-content" : "text-base-content/60 hover:text-base-content"
                }`}
              >
                {o.label}
              </Link>
            ))}
          </div>
        }
      >
        <dl className="grid max-w-3xl grid-cols-2 gap-6 sm:grid-cols-4">
          <Headline label="Events this season" value={String(seasonEvents.length)} />
          <Headline label="Cashes" value={seasonEvents.reduce((n, e) => n + e.entries, 0).toLocaleString("en-GB")} />
          <Headline label="Paid out" value={gbpShort(seasonEvents.reduce((n, e) => n + Number(e.paid_out || 0), 0))} />
          <Headline label="Last event" value={events[0] ? day(events[0].start_date, { day: "numeric", month: "short", year: "numeric" }) : "–"} />
        </dl>
      </PageHeader>

      <div className="mx-auto w-full max-w-7xl space-y-14 px-4 py-10 sm:px-6 lg:px-8">
        <UpcomingList items={upcoming} title={`Next ${series.name} dates`} />

        {/* Record holders */}
        {allRows.length > 0 && (
          <section className="grid gap-4 md:grid-cols-3" aria-label="Record holders">
            <StatCard label="Most wins" value={mostWins?.wins || 0} player={mostWins?.display_name} playerId={mostWins?.player_id} />
            <StatCard label="Most final tables" value={mostFts?.final_tables || 0} player={mostFts?.display_name} playerId={mostFts?.player_id} />
            <StatCard label="Most events" value={mostEvents?.events_played || 0} player={mostEvents?.display_name} playerId={mostEvents?.player_id} />
          </section>
        )}

        <div className="grid gap-8 lg:grid-cols-12">
          {/* Standings */}
          <section className="panel overflow-hidden lg:col-span-8" aria-labelledby="series-standings">
            <div className="flex items-center justify-between border-b border-base-content/[0.07] px-6 py-5">
              <h2 id="series-standings" className="font-display text-xl font-semibold tracking-tight">
                {scope === "season" ? "This season" : "All-time"} standings
              </h2>
              <span className="text-sm text-base-content/45">{totalPlayers.toLocaleString("en-GB")} players</span>
            </div>

            <div className="overflow-x-auto">
              {!paginatedRows.length ? (
                <div className="px-6 py-16 text-center">
                  <div className="font-display text-lg">No results yet</div>
                  <p className="mt-1 text-sm text-base-content/50">
                    {scope === "season" ? "Nothing has been recorded for this season." : "Nothing has been recorded for this series."}
                  </p>
                </div>
              ) : (
                <table className="table w-full">
                  <thead>
                    <tr>
                      <th className="w-16 pl-6 text-center">#</th>
                      <th>Player</th>
                      <th className="text-right">Events</th>
                      <th className="hidden text-right sm:table-cell">Wins</th>
                      <th className="hidden text-right sm:table-cell">FTs</th>
                      <th className="pr-6 text-right">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.map((r) => {
                      const podium = r.position <= 3;
                      return (
                        <tr key={r.player_id} className={`transition-colors hover:bg-base-content/[0.03] ${podium ? "bg-primary/[0.035]" : ""}`}>
                          <td className={`pl-6 text-center font-mono text-base font-semibold ${podium ? "text-primary" : "text-base-content/45"}`}>
                            {r.position}
                          </td>
                          <td>
                            <Link className="group flex items-center gap-3 font-medium" href={`/players/${r.player_id}`}>
                              <Initial name={r.display_name} />
                              <span className="transition-colors group-hover:text-primary">{r.display_name}</span>
                            </Link>
                          </td>
                          <td className="text-right font-mono text-sm text-base-content/60">{r.events_played}</td>
                          <td className="hidden text-right font-mono text-sm text-base-content/60 sm:table-cell">{r.wins > 0 ? r.wins : "–"}</td>
                          <td className="hidden text-right font-mono text-sm text-base-content/60 sm:table-cell">{r.final_tables > 0 ? r.final_tables : "–"}</td>
                          <td className="pr-6 text-right font-mono text-base font-semibold">{Number(r.total_points).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-base-content/[0.07] px-6 py-4">
                <div className="text-sm text-base-content/50">Page {currentPage} of {totalPages}</div>
                <div className="join">
                  <Link href={`?scope=${scope}&page=${currentPage - 1}`} aria-disabled={currentPage <= 1} className={`join-item btn btn-sm ${currentPage <= 1 ? "btn-disabled" : "btn-ghost"}`}>Previous</Link>
                  <Link href={`?scope=${scope}&page=${currentPage + 1}`} aria-disabled={currentPage >= totalPages} className={`join-item btn btn-sm ${currentPage >= totalPages ? "btn-disabled" : "btn-ghost"}`}>Next</Link>
                </div>
              </div>
            )}
          </section>

          {/* Latest champions */}
          <aside className="space-y-4 lg:col-span-4">
            <h2 className="font-display text-lg font-semibold">Latest champions</h2>
            {events.length > 0 ? (
              <ol className="panel divide-y divide-base-content/[0.06]">
                {events.slice(0, 6).map((e) => (
                  <li key={e.id}>
                    <Link href={eventHref(e.id)} className="flex items-start gap-3 p-4 transition-colors hover:bg-base-content/[0.03]">
                      <Trophy size={16} className="mt-1 shrink-0 text-primary" aria-hidden="true" />
                      <div className="min-w-0">
                        <div className="truncate font-display font-medium">{e.winner_name ?? "–"}</div>
                        <div className="truncate text-sm text-base-content/50" title={e.name ?? ""}>{e.name}</div>
                        <div className="mt-0.5 font-mono text-xs text-base-content/35">{day(e.start_date, { day: "numeric", month: "short", year: "numeric" })}</div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="panel p-5 text-sm text-base-content/45">No winners recorded yet.</p>
            )}
          </aside>
        </div>

        {/* Festivals, or recent events for single-event series */}
        {series.has_festivals && festivals.length > 0 ? (
          <section aria-labelledby="series-festivals">
            <h2 id="series-festivals" className="mb-5 font-display text-2xl font-semibold tracking-tight">Festivals</h2>
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {festivals.map((f) => (
                <li key={f.id}><FestivalCard festival={f} series={series} /></li>
              ))}
            </ul>
          </section>
        ) : events.length > 0 ? (
          <section aria-labelledby="series-events">
            <h2 id="series-events" className="mb-5 font-display text-2xl font-semibold tracking-tight">Recent events</h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {events.slice(0, 9).map((e) => (
                <li key={e.id}><ResultCard event={e} series={series} /></li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}

function Headline({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 font-display text-2xl font-semibold tracking-tight">{value}</dd>
    </div>
  );
}

function StatCard({ label, value, player, playerId }: { label: string; value: number; player?: string; playerId?: number }) {
  if (!player || value === 0) return null;
  return (
    <div className="panel flex items-end justify-between gap-4 p-5">
      <div className="min-w-0">
        <div className="eyebrow">{label}</div>
        {playerId ? (
          <Link href={`/players/${playerId}`} className="mt-2 block truncate font-display text-lg font-medium hover:text-primary">{player}</Link>
        ) : (
          <div className="mt-2 truncate font-display text-lg font-medium">{player}</div>
        )}
      </div>
      <div className="font-mono text-3xl font-semibold text-primary">{value}</div>
    </div>
  );
}
