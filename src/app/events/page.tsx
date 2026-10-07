import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { pageMeta } from "@/lib/site";
import { createSupabasePublicClient } from "@/lib/supabasePublic";
import { type EventSummary, type FestivalSummary, type SeriesRow, day, eventHref } from "@/lib/tournaments";
import { type UpcomingEvent, getUpcoming } from "@/lib/venues";
import { ComingUp, TitleBand } from "@/components/tournaments/ComingUp";
import { getSiteImages } from "@/lib/siteImages";
import { Badge, MonthChapter, YearRibbon, eventTitle, monthOf } from "@/components/tournaments/SeasonCalendar";

export const metadata = pageMeta({ title: "Tournaments", description: "Festivals, series and results from across the National Poker League.", path: "/events" });
export const revalidate = 300;

const h2 = "text-[clamp(1.5rem,1.9vw,2rem)] font-semibold leading-tight";
const card = "border border-white/[0.08] bg-[linear-gradient(180deg,#14434a_0%,#0f3337_60%)]";
const more = "group inline-flex min-h-11 items-center gap-2 text-[0.9375rem] font-medium text-season-ink";

export default async function TournamentsPage(props: { searchParams: Promise<{ season?: string }> }) {
  const img = await getSiteImages();
  const sp = await props.searchParams;
  const supabase = createSupabasePublicClient();

  const { data: seasons } = await supabase.from("seasons").select("id, name, year, is_active").order("year", { ascending: false });
  const season = seasons?.find((s) => String(s.year) === sp.season) ?? seasons?.find((s) => s.is_active) ?? seasons?.[0];

  const [{ data: seriesData }, { data: eventData }, { data: festivalData }, upcoming] = await Promise.all([
    supabase.from("series").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("event_summary").select("*").eq("season_id", season?.id ?? -1).order("start_date", { ascending: false }),
    supabase.from("festival_summary").select("*").eq("season_id", season?.id ?? -1).order("start_date", { ascending: false }),
    season?.is_active ? getUpcoming({ limit: 4 }) : Promise.resolve([] as UpcomingEvent[]),
  ]);

  const series = (seriesData || []) as SeriesRow[];
  const events = (eventData || []) as EventSummary[];
  const festivals = (festivalData || []) as FestivalSummary[];
  const seriesById = new Map(series.map((s) => [s.id, s]));
  const singles = events.filter((e) => !e.festival_id);
  const year = season?.year ?? new Date().getFullYear();

  const perSeries = new Map<number, { events: number; festivals: number }>();
  for (const e of events) if (e.series_id) {
    const p = perSeries.get(e.series_id) ?? { events: 0, festivals: 0 };
    p.events++;
    perSeries.set(e.series_id, p);
  }
  for (const f of festivals) if (f.series_id && perSeries.has(f.series_id)) perSeries.get(f.series_id)!.festivals++;

  // Month chapters, newest first: a festival belongs to the month it starts in.
  const months = [...new Set([...festivals.map((f) => monthOf(f.start_date)), ...singles.map((e) => monthOf(e.start_date))])]
    .filter((m) => m >= 0)
    .sort((a, b) => b - a);
  const latestMonth = events[0]?.start_date ? monthOf(events[0].start_date) : null;
  const latest = events.slice(0, 6);

  return (
    <div className="bg-season-night font-season text-season-ink">
      <TitleBand image={img.tournaments_hero}>
          <h1 className="text-[clamp(2.5rem,4.4vw,4.375rem)] font-bold leading-[1.02] tracking-[-0.012em]">The {year} season</h1>
          <p className="mt-2 text-[clamp(1.0625rem,1.45vw,1.375rem)] font-medium tabular-nums text-season-muted">
            {events.length.toLocaleString("en-GB")} {events.length === 1 ? "event" : "events"} · {festivals.length} {festivals.length === 1 ? "festival" : "festivals"}
          </p>
          <nav aria-label="Season" className="mt-5 inline-flex rounded-[3px] border border-white/[0.12]">
            {(seasons || []).map((s) => {
              const on = s.id === season?.id;
              return (
                <Link
                  key={s.id}
                  href={s.is_active ? "/events" : `/events?season=${s.year}`}
                  aria-current={on ? "page" : undefined}
                  className={`-m-px flex h-11 items-center rounded-[3px] px-[1.1rem] text-[0.9375rem] font-medium tabular-nums transition-colors ${
                    on ? "relative z-10 bg-season-amber/[0.12] font-semibold shadow-[inset_0_0_0_1px_var(--color-season-amber)]" : "text-season-ink/75 hover:text-season-ink"
                  }`}
                >
                  {s.year}
                </Link>
              );
            })}
          </nav>
      </TitleBand>

      <div className="space-y-[clamp(2.5rem,4vw,4rem)] px-4 pb-[clamp(2.5rem,4vw,4rem)] sm:px-[3.6vw]">
        <ComingUp items={upcoming} seriesById={seriesById} />

        {/* Latest results */}
        {latest.length > 0 && (
          <section aria-labelledby="latest-results" className={upcoming.length ? "" : "mt-[clamp(1rem,2vw,2rem)]"}>
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
              <h2 id="latest-results" className={h2}>Latest results</h2>
              <a href="#season" className={more}>
                Every result this season
                <ArrowRight size={17} strokeWidth={2.25} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
              </a>
            </div>
            <ul className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {latest.map((e) => (
                <li key={e.id} className="min-w-0">
                  <Link href={eventHref(e.id)} className={`${card} group flex h-full flex-col gap-3 p-4 transition-colors hover:border-white/20`}>
                    <span className="text-[0.875rem] tabular-nums text-season-muted">{day(e.start_date)}</span>
                    <span className="flex h-6 items-center">{e.series_id && <Badge series={seriesById.get(e.series_id)} className="h-6" />}</span>
                    <span className="line-clamp-2 text-[0.9375rem] font-medium leading-snug decoration-season-ink/40 underline-offset-4 group-hover:underline">{eventTitle(e.name)}</span>
                    <span className="mt-auto text-[0.875rem]">
                      <span className="block text-season-muted">Won by</span>
                      <span className="block truncate font-semibold text-season-amber">{e.winner_name ?? "–"}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {!events.length && (
          <p className="pt-4 text-[1.0625rem] text-season-ink/80">No results for the {year} season yet. They appear here after each weekly update.</p>
        )}

        {/* Series: straight to any series */}
        <section aria-labelledby="all-series">
          <h2 id="all-series" className={h2}>Series</h2>
          <ul className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {series.map((s) => {
              const p = perSeries.get(s.id);
              return (
                <li key={s.id}>
                  <Link href={`/events/${s.slug}`} className={`${card} group flex h-full flex-col items-center justify-center gap-2 px-4 py-4 text-center transition-colors hover:border-white/25`}>
                    <span className="flex h-9 items-center justify-center">
                      {s.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.logo_url} alt={s.name} className="h-8 w-auto max-w-[9rem] object-contain sm:h-9" />
                      ) : (
                        <span className="text-[1.375rem] font-bold">{s.name}</span>
                      )}
                    </span>
                    <span className="text-[0.875rem] tabular-nums text-season-muted">
                      {p ? `${p.events} ${p.events === 1 ? "event" : "events"}${p.festivals ? ` · ${p.festivals} ${p.festivals === 1 ? "festival" : "festivals"}` : ""}` : `No events in ${year}`}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="mt-5 text-[0.9375rem] text-season-muted">
            Looking for a casino?{" "}
            <Link href="/venues" className="font-medium text-season-ink underline decoration-season-ink/30 underline-offset-4 hover:decoration-season-ink">Browse all venues</Link>
          </p>
        </section>

        {/* The season: the year ribbon, then every month as a chapter */}
        {months.length > 0 && (
          <section id="season" aria-labelledby="season-heading" className="scroll-mt-24">
            <h2 id="season-heading" className={h2}>The season</h2>
            <div className="mt-5">
              <YearRibbon
                year={year}
                series={series}
                festivals={festivals}
                singles={singles}
                current={season?.is_active ? latestMonth : null}
                chapters={new Set(months)}
              />
            </div>
            <div className="mt-[clamp(2.5rem,4vw,3.5rem)] space-y-[clamp(2.5rem,4vw,3.5rem)]">
              {months.map((m, i) => (
                <MonthChapter
                  key={m}
                  month={m}
                  festivals={festivals.filter((f) => monthOf(f.start_date) === m)}
                  singles={singles.filter((e) => monthOf(e.start_date) === m)}
                  seriesById={seriesById}
                  stillOffset={i}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
