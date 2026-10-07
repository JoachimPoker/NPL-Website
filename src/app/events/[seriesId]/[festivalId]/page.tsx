import Link from "next/link";
import { pageMeta } from "@/lib/site";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowRight, MapPin, Trophy } from "lucide-react";
import ShareButton from "@/components/ShareButton";
import { createSupabasePublicClient } from "@/lib/supabasePublic";
import { venueHref } from "@/lib/venues";
import { decodeEntities } from "@/lib/nameMask";
import { TitleBand } from "@/components/tournaments/ComingUp";
import { Badge, festivalTitle } from "@/components/tournaments/SeasonCalendar";
import { getFestivalPhotos, getSiteImages } from "@/lib/siteImages";
import {
  type EventSummary, type FestivalSummary, type SeriesRow,
  gbp, gbpShort, day, dateRange, eventHref, festivalHref, seriesHref, shortEventName,
} from "@/lib/tournaments";

export const revalidate = 300;
// None built ahead: each page is rendered on its first visit, then served from cache.
export function generateStaticParams() {
  return [];
}

const h2 = "text-[clamp(1.3125rem,1.6vw,1.6875rem)] font-semibold leading-tight";
/** The event's own name within the festival, without its guarantee ("Mini Main", not "Mini Main – £100,000 GTD"). */
const eventName = (name: string | null) => shortEventName(name).split(/\s+[-–]\s+£/)[0].trim();

async function load(seriesParam: string, festivalId: string) {
  const supabase = createSupabasePublicClient();
  const { data: festival } = await supabase.from("festival_summary").select("*").eq("id", festivalId).maybeSingle();
  if (!festival) return null;

  const [{ data: series }, { data: events }] = await Promise.all([
    supabase.from("series").select("*").eq("id", festival.series_id ?? -1).maybeSingle(),
    supabase.from("event_summary").select("*").eq("festival_id", festivalId).order("start_date"),
  ]);
  if (!series || (series.slug !== seriesParam && String(series.id) !== seriesParam)) return null;

  // Festival leaderboard: points across all its events, computed in the database
  // (big festivals have more results than one API request returns).
  const { data: lb } = await supabase.rpc("festival_leaderboard", { p_festival_id: festivalId, p_limit: 25 });
  const leaderboard = (lb || []).map((p) => ({ id: p.player_id, name: decodeEntities(p.display_name), points: Number(p.points), events: p.events }));

  return { festival: festival as FestivalSummary, series: series as SeriesRow, events: (events || []) as EventSummary[], leaderboard };
}

export async function generateMetadata(props: { params: Promise<{ seriesId: string; festivalId: string }> }): Promise<Metadata> {
  const { seriesId, festivalId } = await props.params;
  const data = await load(seriesId, festivalId);
  if (!data) return { title: "Festival" };
  const { festival: f, series } = data;
  return pageMeta({
    title: f.label,
    description: `${series.name} at ${f.casino ?? "the venue"}, ${dateRange(f.start_date, f.end_date)}: ${f.events} events, ${f.entries.toLocaleString("en-GB")} cashes${f.main_event_winner ? `, Main Event won by ${f.main_event_winner}` : ""}.`,
    path: festivalHref(series, f.id),
  });
}

export default async function FestivalPage(props: { params: Promise<{ seriesId: string; festivalId: string }> }) {
  const img = await getSiteImages();
  const festivalPhotos = await getFestivalPhotos();
  const { seriesId, festivalId } = await props.params;
  const data = await load(seriesId, festivalId);
  if (!data) notFound();
  const { festival, series, events, leaderboard } = data;
  const main = festival.main_event_id ? events.find((e) => e.id === festival.main_event_id) : null;

  return (
    <div className="bg-season-night font-season text-season-ink">
      <TitleBand image={festivalPhotos.get(String(festival.id)) || series.image_url || img.room_1} position="object-[55%_50%]">
        <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-x-2 text-[0.9375rem] font-medium text-season-ink/75">
          <Link href="/events" className="inline-flex min-h-11 items-center hover:text-season-ink">Tournaments</Link>
          <span aria-hidden="true" className="text-season-ink/40">/</span>
          <Link href={seriesHref(series)} className="inline-flex min-h-11 items-center hover:text-season-ink">{series.name}</Link>
        </nav>
        <Badge series={series} className="h-8" />
        <h1 className="mt-4 text-[clamp(2.5rem,4.4vw,4.375rem)] font-bold leading-[1.02] tracking-[-0.012em]">{festivalTitle(festival.label)}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[clamp(1.0625rem,1.45vw,1.375rem)] font-medium text-season-muted">
          <span className="tabular-nums">{dateRange(festival.start_date, festival.end_date)}</span>
          {festival.casino && (
            <>
              <span aria-hidden="true">·</span>
              <MapPin size={18} aria-hidden="true" className="text-season-muted" />
              <Link href={venueHref(festival.casino)} className="hover:underline hover:decoration-season-ink/40 hover:underline-offset-4">{festival.casino}</Link>
            </>
          )}
        </p>
        <p className="mt-1.5 text-[1.0625rem] tabular-nums text-season-ink/65">
          {festival.events} {festival.events === 1 ? "event" : "events"} · {festival.entries.toLocaleString("en-GB")} cashes
        </p>
      </TitleBand>

      <div className="space-y-[clamp(3rem,5vw,5rem)] px-4 pb-[clamp(2.5rem,4vw,4rem)] sm:px-[3.6vw]">
        {/* The Main Event: the festival's headline result */}
        {festival.main_event_winner && (
          <section aria-labelledby="main-event" className="flex flex-col gap-5 border border-season-amber/60 bg-[linear-gradient(180deg,#14434a_0%,#0f3337_60%)] px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div className="flex min-w-0 items-center gap-5">
              <Trophy size={34} strokeWidth={1.75} className="shrink-0 text-season-amber" aria-hidden="true" />
              <div className="min-w-0">
                <h2 id="main-event" className="text-[1.0625rem] font-medium text-season-ink/75">{main ? eventName(main.name) : "Main Event"} won by</h2>
                <p className="text-[clamp(1.75rem,2.8vw,2.75rem)] font-bold leading-[1.05] tracking-[-0.01em] text-season-amber">
                  {festival.main_event_winner_id ? (
                    <Link href={`/players/${festival.main_event_winner_id}`} className="hover:underline hover:decoration-season-amber/50 hover:underline-offset-4">{festival.main_event_winner}</Link>
                  ) : (
                    festival.main_event_winner
                  )}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-3">
              {festival.main_event_id && (
                <Link href={eventHref(festival.main_event_id)} className="group inline-flex min-h-11 items-center gap-2 text-[0.9375rem] font-medium">
                  Full Main Event result
                  <ArrowRight size={17} strokeWidth={2.25} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}
              <ShareButton
                title={festival.label}
                className="inline-flex h-11 items-center gap-2 rounded-[3px] border border-white/[0.14] px-4 text-[0.9375rem] font-medium text-season-ink transition-colors hover:border-white/30"
              />
            </div>
          </section>
        )}

        <div className="grid gap-x-[clamp(2rem,4vw,4.5rem)] gap-y-14 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          {/* Schedule and winners */}
          <section aria-labelledby="schedule" className="min-w-0">
            <h2 id="schedule" className={h2}>Schedule and winners</h2>
            <ol className="mt-5 border-t border-white/[0.12]">
              {events.map((e) => {
                const isMain = e.id === festival.main_event_id;
                return (
                  <li key={e.id} className="border-b border-white/[0.07]">
                    <Link href={eventHref(e.id)} className="group grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-x-4 py-3.5 transition-colors hover:bg-white/[0.025]">
                      <time dateTime={e.start_date ?? undefined} className="text-[0.875rem] leading-tight tabular-nums text-season-muted">
                        <span className="block">{day(e.start_date, { weekday: "short" })}</span>
                        <span className="block text-season-ink/80">{day(e.start_date)}</span>
                      </time>
                      <span className="min-w-0">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className={`truncate text-[1.0625rem] decoration-season-ink/40 underline-offset-4 group-hover:underline ${isMain ? "font-semibold" : "font-medium"}`}>
                            {eventName(e.name)}
                          </span>
                          {e.is_high_roller && !/high roller/i.test(eventName(e.name)) && <span className="shrink-0 rounded-[3px] px-1.5 text-[0.75rem] font-semibold text-season-ink/80 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.2)]">High Roller</span>}
                        </span>
                        <span className="flex min-w-0 items-center gap-1.5 text-[0.9375rem]">
                          <Trophy size={13} className="shrink-0 text-season-amber" aria-hidden="true" />
                          <span className={`truncate ${e.winner_name ? "font-semibold text-season-amber" : "text-season-muted"}`}>{e.winner_name ?? "–"}</span>
                        </span>
                      </span>
                      <span className="text-right text-[0.875rem] tabular-nums text-season-muted">
                        <span className="block">{e.buy_in ? gbp(Number(e.buy_in)) : "Free"}</span>
                        <span className="block">{e.entries} cashes</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
            {Number(festival.paid_out) > 0 && (
              <p className="mt-3 text-[0.875rem] tabular-nums text-season-muted">{gbpShort(Number(festival.paid_out))} paid out across the festival.</p>
            )}
          </section>

          {/* Festival leaderboard */}
          <section aria-labelledby="festival-standings" className="min-w-0">
            <h2 id="festival-standings" className={h2}>Festival leaderboard</h2>
            <p className="mt-1 text-[0.9375rem] text-season-muted">League points earned across this festival</p>
            {leaderboard.length ? (
              <table className="mt-5 w-full border-collapse text-left tabular-nums">
                <thead>
                  <tr className="border-b border-white/[0.12] text-[0.875rem] text-season-muted">
                    <th scope="col" className="w-12 pb-3 pr-3 font-medium">Rank</th>
                    <th scope="col" className="w-full pb-3 font-medium">Player</th>
                    <th scope="col" className="pb-3 pl-4 text-right font-medium">Events</th>
                    <th scope="col" className="pb-3 pl-4 text-right font-medium">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((p, i) => (
                    <tr key={p.id} className="border-b border-white/[0.07] transition-colors hover:bg-white/[0.025]">
                      <td className={`pr-3 font-semibold ${i < 3 ? "text-season-amber" : ""}`}>{i + 1}</td>
                      <td className="max-w-0">
                        <Link href={`/players/${p.id}`} className={`block truncate py-3 decoration-season-ink/40 underline-offset-4 hover:underline ${i < 3 ? "font-semibold" : ""}`}>{p.name}</Link>
                      </td>
                      <td className="pl-4 text-right text-season-ink/80">{p.events}</td>
                      <td className={`whitespace-nowrap pl-4 text-right font-semibold ${i < 3 ? "text-season-amber" : ""}`}>{p.points.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="mt-5 text-season-ink/80">The leaderboard fills in once results are in.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
