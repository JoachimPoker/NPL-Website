import Link from "next/link";
import { pageMeta } from "@/lib/site";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { createSupabasePublicClient } from "@/lib/supabasePublic";
import { decodeEntities } from "@/lib/nameMask";
import { getVenues, getUpcoming, venueSlug } from "@/lib/venues";
import { type EventSummary, type FestivalSummary, type SeriesRow, gbp, day } from "@/lib/tournaments";
import { ComingUp, TitleBand } from "@/components/tournaments/ComingUp";
import { getSiteImages, getVenuePhotos } from "@/lib/siteImages";
import { EventRows, FestivalStrip } from "@/components/tournaments/SeasonCalendar";

export const revalidate = 600;
// None built ahead: each page is rendered on its first visit, then served from cache.
export function generateStaticParams() {
  return [];
}

const h2 = "text-[clamp(1.3125rem,1.6vw,1.6875rem)] font-semibold leading-tight";

async function findVenue(slug: string) {
  return (await getVenues()).find((v) => venueSlug(v.casino) === slug) ?? null;
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const v = await findVenue((await props.params).slug);
  if (!v) return { title: "Venue" };
  return pageMeta({
    title: v.casino,
    description: `${v.events} league events and ${v.cashes.toLocaleString("en-GB")} cashes at ${v.casino}: results, top players and upcoming dates.`,
    path: `/venues/${venueSlug(v.casino)}`,
  });
}

export default async function VenuePage(props: { params: Promise<{ slug: string }> }) {
  const img = await getSiteImages();
  const venuePhotos = await getVenuePhotos();
  const venue = await findVenue((await props.params).slug);
  if (!venue) notFound();

  const supabase = createSupabasePublicClient();
  const [{ data: events }, { data: festivals }, { data: series }, { data: top }, upcoming] = await Promise.all([
    supabase.from("event_summary").select("*").eq("casino", venue.casino).order("start_date", { ascending: false }).limit(12),
    supabase.from("festival_summary").select("*").eq("casino", venue.casino).order("start_date", { ascending: false }).limit(6),
    supabase.from("series").select("*"),
    supabase.rpc("venue_top_players", { p_casino: venue.casino, p_limit: 10 }),
    getUpcoming({ casino: venue.casino }),
  ]);
  const seriesById = new Map(((series || []) as SeriesRow[]).map((s) => [s.id, s]));
  const fests = (festivals || []) as FestivalSummary[];
  const players = ((top || []) as { player_id: number; display_name: string; cashes: number; wins: number; final_tables: number; money: number }[]).map((p) => ({
    ...p,
    display_name: decodeEntities(p.display_name),
  }));

  return (
    <div className="bg-season-night font-season text-season-ink">
      <TitleBand image={venuePhotos.get(venue.casino) || img.venues_hero} position="object-[65%_50%]">
        <Link href="/venues" className="mb-5 inline-flex min-h-11 items-center gap-1.5 text-[0.9375rem] font-medium text-season-ink/75 hover:text-season-ink">
          <ArrowLeft size={16} strokeWidth={2.25} aria-hidden="true" /> Venues
        </Link>
        <h1 className="text-[clamp(2.5rem,4.4vw,4.375rem)] font-bold leading-[1.02] tracking-[-0.012em]">{venue.casino}</h1>
        <p className="mt-2 text-[clamp(1.0625rem,1.45vw,1.375rem)] font-medium text-season-muted">
          League events since {day(venue.first_event, { month: "long", year: "numeric" })}
        </p>
        <p className="mt-1.5 text-[1.0625rem] tabular-nums text-season-ink/65">
          {venue.events.toLocaleString("en-GB")} events
          {venue.festivals > 0 && ` · ${venue.festivals} ${venue.festivals === 1 ? "festival" : "festivals"}`} · {venue.cashes.toLocaleString("en-GB")} cashes
        </p>
      </TitleBand>

      <div className="space-y-[clamp(2.5rem,4vw,4rem)] px-4 pb-[clamp(2.5rem,4vw,4rem)] sm:px-[3.6vw]">
        <ComingUp items={upcoming} seriesById={seriesById} title={`Coming up at ${venue.casino}`} />

        <div className="grid gap-x-[clamp(2rem,4vw,4.5rem)] gap-y-14 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <section aria-labelledby="recent" className="min-w-0">
            <h2 id="recent" className={h2}>Recent results</h2>
            <EventRows events={(events || []) as EventSummary[]} seriesById={seriesById} className="mt-5 border-t border-white/[0.12]" />
          </section>

          {players.length > 0 && (
            <section aria-labelledby="venue-top" className="min-w-0">
              <h2 id="venue-top" className={h2}>Top players here</h2>
              <p className="mt-1 text-[0.9375rem] text-season-muted">Their record at {venue.casino}, by prize money won here</p>
              <table className="mt-5 w-full border-collapse text-left tabular-nums">
                <thead>
                  <tr className="border-b border-white/[0.12] text-[0.875rem] text-season-muted">
                    <th scope="col" className="w-10 pb-3 pr-3 font-medium">#</th>
                    <th scope="col" className="w-full pb-3 font-medium">Player</th>
                    <th scope="col" className="pb-3 pl-4 text-right font-medium">Cashes</th>
                    <th scope="col" className="pb-3 pl-4 text-right font-medium">Wins</th>
                    <th scope="col" className="hidden pb-3 pl-4 text-right font-medium sm:table-cell">Won</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((p, i) => (
                    <tr key={p.player_id} className="border-b border-white/[0.07]">
                      <td className="pr-3 text-season-muted">{i + 1}</td>
                      <td className="max-w-0">
                        <Link href={`/players/${p.player_id}`} className="block truncate py-3 font-medium decoration-season-ink/40 underline-offset-4 hover:underline">{p.display_name}</Link>
                      </td>
                      <td className="pl-4 text-right">{p.cashes}</td>
                      <td className="pl-4 text-right">{p.wins || <span className="text-season-muted">–</span>}</td>
                      <td className="hidden whitespace-nowrap pl-4 text-right text-season-ink/70 sm:table-cell">{gbp(Number(p.money))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </div>

        {fests.length > 0 && (
          <section aria-labelledby="venue-festivals">
            <h2 id="venue-festivals" className={h2}>Festivals here</h2>
            <div className="mt-5 space-y-4">
              {fests.map((f, i) => (
                <FestivalStrip key={f.id} festival={f} series={f.series_id ? seriesById.get(f.series_id) : undefined} still={i} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
