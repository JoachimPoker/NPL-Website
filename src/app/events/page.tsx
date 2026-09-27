import Link from "next/link";
import { pageMeta } from "@/lib/site";
import PageHeader from "@/components/PageHeader";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { type EventSummary, type FestivalSummary, type SeriesRow, gbpShort } from "@/lib/tournaments";
import { FestivalCard, ResultCard, SeriesTile } from "@/components/tournaments/TournamentCards";
import UpcomingList from "@/components/tournaments/UpcomingList";
import { getUpcoming } from "@/lib/venues";

export const metadata = pageMeta({ title: "Tournaments", description: "Festivals, series and results from across the National Poker League.", path: "/events" });
export const revalidate = 300;

export default async function TournamentsPage(props: { searchParams: Promise<{ season?: string }> }) {
  const sp = await props.searchParams;
  const supabase = await createSupabaseServerClient();

  const { data: seasons } = await supabase
    .from("seasons")
    .select("id, name, year, is_active")
    .order("year", { ascending: false });
  const season =
    seasons?.find((s) => String(s.year) === sp.season) ?? seasons?.find((s) => s.is_active) ?? seasons?.[0];

  const [{ data: seriesData }, { data: eventData }, { data: festivalData }, upcoming] = await Promise.all([
    supabase.from("series").select("id, name, slug, description, logo_url, has_festivals, sort_order").eq("is_active", true).order("sort_order"),
    supabase.from("event_summary").select("*").eq("season_id", season?.id ?? -1).order("start_date", { ascending: false }),
    supabase.from("festival_summary").select("*").eq("season_id", season?.id ?? -1).order("start_date", { ascending: false }),
    getUpcoming(),
  ]);

  const series = (seriesData || []) as SeriesRow[];
  const events = (eventData || []) as EventSummary[];
  const festivals = (festivalData || []) as FestivalSummary[];
  const seriesById = new Map(series.map((s) => [s.id, s]));
  const seriesNames = new Map(series.map((s) => [s.id, s.name]));

  const totals = {
    events: events.length,
    festivals: festivals.length,
    cashes: events.reduce((n, e) => n + e.entries, 0),
    paid: events.reduce((n, e) => n + Number(e.paid_out || 0), 0),
  };

  const perSeries = new Map<number, { events: number; festivals: number; last: string | null }>();
  for (const e of events) {
    if (!e.series_id) continue;
    const p = perSeries.get(e.series_id) ?? { events: 0, festivals: 0, last: null };
    p.events++;
    if (!p.last || (e.start_date && e.start_date > p.last)) p.last = e.start_date;
    perSeries.set(e.series_id, p);
  }
  for (const f of festivals) {
    if (f.series_id && perSeries.has(f.series_id)) perSeries.get(f.series_id)!.festivals++;
  }

  const latest = events.slice(0, 6);
  const shownFestivals = festivals.filter((f) => f.series_id && seriesById.has(f.series_id));

  return (
    <>
      <PageHeader
        eyebrow="Tournaments"
        title="Every event, every result"
        description="Festivals, series and results from across the league. Pick a season to look back."
        actions={
          <nav aria-label="Season" className="inline-flex rounded-lg bg-base-100 p-1 ring-1 ring-inset ring-base-content/[0.07]">
            {(seasons || []).map((s) => {
              const active = s.id === season?.id;
              return (
                <Link
                  key={s.id}
                  href={s.is_active ? "/events" : `/events?season=${s.year}`}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                    active ? "bg-primary text-primary-content" : "text-base-content/60 hover:text-base-content"
                  }`}
                >
                  {s.year}
                </Link>
              );
            })}
          </nav>
        }
      >
        <dl className="grid max-w-3xl grid-cols-2 gap-6 sm:grid-cols-4">
          <HeadlineStat label="Events" value={totals.events.toLocaleString("en-GB")} />
          <HeadlineStat label="Festivals" value={totals.festivals.toLocaleString("en-GB")} />
          <HeadlineStat label="Cashes" value={totals.cashes.toLocaleString("en-GB")} />
          <HeadlineStat label="Paid out" value={gbpShort(totals.paid)} />
        </dl>
      </PageHeader>

      <div className="mx-auto w-full max-w-7xl space-y-16 px-4 py-12 sm:px-6 lg:px-8">
        {season?.is_active && <UpcomingList items={upcoming} seriesNames={seriesNames} />}

        {!events.length ? (
          <div className="panel px-6 py-16 text-center">
            <div className="font-display text-lg">No results for {season?.name ?? "this season"} yet</div>
            <p className="mt-1 text-sm text-base-content/50">Results appear here after each weekly update.</p>
          </div>
        ) : (
          <>
            <section aria-labelledby="latest-results">
              <SectionHeading id="latest-results" title="Latest results" note="Most recent first" />
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {latest.map((e) => (
                  <li key={e.id}>
                    <ResultCard event={e} series={e.series_id ? seriesById.get(e.series_id) : null} />
                  </li>
                ))}
              </ul>
            </section>

            {shownFestivals.length > 0 && (
              <section aria-labelledby="festivals">
                <SectionHeading id="festivals" title="Festivals" note={`${shownFestivals.length} this season`} />
                <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {shownFestivals.map((f) => (
                    <li key={f.id}>
                      <FestivalCard festival={f} series={seriesById.get(f.series_id!)!} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        <section aria-labelledby="all-series">
          <SectionHeading id="all-series" title="Series" note="Standings, champions and every festival" />
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {series.map((s) => {
              const p = perSeries.get(s.id);
              return (
                <li key={s.id}>
                  <SeriesTile series={s} events={p?.events ?? 0} festivals={p?.festivals ?? 0} lastDate={p?.last ?? null} />
                </li>
              );
            })}
          </ul>
          <p className="mt-6 text-sm text-base-content/55">
            Looking for a casino?{" "}
            <Link href="/venues" className="font-medium text-primary hover:underline">Browse all venues</Link>
          </p>
        </section>
      </div>
    </>
  );
}

function HeadlineStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 font-display text-3xl font-semibold tracking-tight">{value}</dd>
    </div>
  );
}

function SectionHeading({ id, title, note }: { id: string; title: string; note?: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <h2 id={id} className="font-display text-2xl font-semibold tracking-tight">{title}</h2>
      {note && <span className="text-sm text-base-content/45">{note}</span>}
    </div>
  );
}
