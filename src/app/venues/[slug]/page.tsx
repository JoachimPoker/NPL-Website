import Link from "next/link";
import { pageMeta } from "@/lib/site";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import { Initial } from "@/components/HomeLeaderboard";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { getVenues, getUpcoming, venueSlug } from "@/lib/venues";
import { type EventSummary, type FestivalSummary, type SeriesRow, gbp, gbpShort, day } from "@/lib/tournaments";
import { FestivalCard, ResultCard } from "@/components/tournaments/TournamentCards";
import UpcomingList from "@/components/tournaments/UpcomingList";

export const revalidate = 600;

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
  const venue = await findVenue((await props.params).slug);
  if (!venue) notFound();

  const supabase = await createSupabaseServerClient();
  const [{ data: events }, { data: festivals }, { data: series }, { data: top }, upcoming] = await Promise.all([
    supabase.from("event_summary").select("*").eq("casino", venue.casino).order("start_date", { ascending: false }).limit(6),
    supabase.from("festival_summary").select("*").eq("casino", venue.casino).order("start_date", { ascending: false }).limit(6),
    supabase.from("series").select("id, name, slug, description, logo_url, has_festivals, sort_order"),
    supabase.rpc("venue_top_players", { p_casino: venue.casino, p_limit: 10 }),
    getUpcoming({ casino: venue.casino }),
  ]);
  const seriesById = new Map(((series || []) as SeriesRow[]).map((s) => [s.id, s]));
  const seriesNames = new Map([...seriesById.values()].map((s) => [s.id, s.name]));

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/venues" className="hover:text-primary">Venues</Link>}
        title={venue.casino}
        description={`League events since ${day(venue.first_event, { month: "long", year: "numeric" })}.`}
      >
        <dl className="grid max-w-3xl grid-cols-2 gap-6 sm:grid-cols-4">
          {[
            ["Events", venue.events.toLocaleString("en-GB")],
            ["Festivals", venue.festivals.toLocaleString("en-GB")],
            ["Cashes", venue.cashes.toLocaleString("en-GB")],
            ["Paid out", gbpShort(Number(venue.paid_out))],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="eyebrow">{label}</dt>
              <dd className="mt-1 font-display text-2xl font-semibold tracking-tight">{value}</dd>
            </div>
          ))}
        </dl>
      </PageHeader>

      <div className="mx-auto w-full max-w-7xl space-y-14 px-4 py-10 sm:px-6 lg:px-8">
        <UpcomingList items={upcoming} seriesNames={seriesNames} title={`Coming up at ${venue.casino}`} />

        <div className="grid gap-10 lg:grid-cols-12">
          <section className="lg:col-span-7" aria-label="Recent results">
            <h2 className="mb-5 font-display text-2xl font-semibold tracking-tight">Recent results</h2>
            <ul className="grid gap-4 sm:grid-cols-2">
              {((events || []) as EventSummary[]).map((e) => (
                <li key={e.id}><ResultCard event={e} series={e.series_id ? seriesById.get(e.series_id) : null} /></li>
              ))}
            </ul>
          </section>

          <section className="panel h-fit overflow-hidden lg:col-span-5" aria-labelledby="venue-top">
            <div className="border-b border-base-content/[0.07] px-6 py-5">
              <h2 id="venue-top" className="font-display text-xl font-semibold tracking-tight">Top players here</h2>
              <p className="text-sm text-base-content/45">By winnings at {venue.casino}</p>
            </div>
            <table className="table w-full">
              <thead>
                <tr><th className="w-10 pl-6 text-center">#</th><th>Player</th><th className="text-right">Cashes</th><th className="pr-6 text-right">Won</th></tr>
              </thead>
              <tbody>
                {(top || []).map((p: any, i: number) => (
                  <tr key={p.player_id}>
                    <td className="pl-6 text-center font-mono text-sm text-base-content/50">{i + 1}</td>
                    <td>
                      <Link href={`/players/${p.player_id}`} className="group flex items-center gap-3 font-medium">
                        <Initial name={p.display_name} />
                        <span className="truncate transition-colors group-hover:text-primary">{p.display_name}</span>
                      </Link>
                    </td>
                    <td className="text-right font-mono text-sm text-base-content/60">{p.cashes}</td>
                    <td className="pr-6 text-right font-mono text-sm font-semibold">{gbp(Number(p.money))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        {(festivals || []).length > 0 && (
          <section aria-label="Festivals here">
            <h2 className="mb-5 font-display text-2xl font-semibold tracking-tight">Festivals here</h2>
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {((festivals || []) as FestivalSummary[]).map((f) => {
                const s = f.series_id ? seriesById.get(f.series_id) : undefined;
                return s ? <li key={f.id}><FestivalCard festival={f} series={s} /></li> : null;
              })}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
