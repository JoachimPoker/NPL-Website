import Link from "next/link";
import { pageMeta } from "@/lib/site";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Trophy } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import ShareButton from "@/components/ShareButton";
import { Initial } from "@/components/HomeLeaderboard";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { venueHref } from "@/lib/venues";
import { SeriesMark } from "@/components/tournaments/TournamentCards";
import {
  type EventSummary, type FestivalSummary, type SeriesRow,
  gbp, gbpShort, day, dateRange, eventHref, festivalHref, seriesHref, shortEventName,
} from "@/lib/tournaments";

export const revalidate = 300;

async function load(seriesParam: string, festivalId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: festival } = await supabase.from("festival_summary").select("*").eq("id", festivalId).maybeSingle();
  if (!festival) return null;

  const [{ data: series }, { data: events }] = await Promise.all([
    supabase.from("series").select("id, name, slug, description, logo_url, has_festivals, sort_order").eq("id", festival.series_id ?? -1).maybeSingle(),
    supabase.from("event_summary").select("*").eq("festival_id", festivalId).order("start_date"),
  ]);
  if (!series || (series.slug !== seriesParam && String(series.id) !== seriesParam)) return null;

  // Festival leaderboard: points across all its events, computed in the database
  // (big festivals have more results than one API request returns).
  const { data: lb } = await supabase.rpc("festival_leaderboard", { p_festival_id: festivalId, p_limit: 25 });
  const leaderboard = (lb || []).map((p) => ({ id: p.player_id, name: p.display_name, points: Number(p.points), events: p.events }));

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
  const { seriesId, festivalId } = await props.params;
  const data = await load(seriesId, festivalId);
  if (!data) notFound();
  const { festival, series, events, leaderboard } = data;

  return (
    <>
      <PageHeader
        eyebrow={
          <nav aria-label="Breadcrumb" className="flex items-center gap-2">
            <Link href="/events" className="hover:text-primary">Tournaments</Link>
            <span className="text-base-content/30">/</span>
            <Link href={seriesHref(series)} className="hover:text-primary">{series.name}</Link>
          </nav>
        }
        title={festival.label.replace(/\s·\s\w{3}\s\d{4}$/, "")}
        description={
          <>
            {dateRange(festival.start_date, festival.end_date)}
            {festival.casino && (
              <> · <Link href={venueHref(festival.casino)} className="hover:text-primary">{festival.casino}</Link></>
            )}
          </>
        }
        actions={
          <div className="flex items-center gap-4">
            <ShareButton title={festival.label} />
            <SeriesMark series={series} size="lg" />
          </div>
        }
      >
        <dl className="grid max-w-3xl grid-cols-2 gap-6 sm:grid-cols-4">
          <Headline label="Events" value={String(festival.events)} />
          <Headline label="Cashes" value={festival.entries.toLocaleString("en-GB")} />
          <Headline label="Paid out" value={gbpShort(Number(festival.paid_out))} />
          <Headline label="Main Event" value={festival.main_event_winner ?? "–"} small />
        </dl>
      </PageHeader>

      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-12 lg:px-8">
        <section className="panel overflow-hidden lg:col-span-7" aria-labelledby="schedule">
          <div className="border-b border-base-content/[0.07] px-6 py-5">
            <h2 id="schedule" className="font-display text-xl font-semibold tracking-tight">Schedule &amp; winners</h2>
          </div>
          <ol className="divide-y divide-base-content/[0.06]">
            {events.map((e) => (
              <li key={e.id}>
                <Link href={eventHref(e.id)} className="group grid grid-cols-[auto_1fr_auto] items-center gap-4 px-6 py-4 transition-colors hover:bg-base-content/[0.03]">
                  <time className="w-14 font-mono text-xs uppercase text-base-content/45">
                    {day(e.start_date, { weekday: "short" })}<br />{day(e.start_date)}
                  </time>
                  <span className="min-w-0">
                    <span className="block truncate font-medium transition-colors group-hover:text-primary">
                      {shortEventName(e.name)}
                      {e.is_high_roller && <span className="badge badge-secondary badge-xs ml-2 align-middle">HR</span>}
                    </span>
                    <span className="flex items-center gap-1.5 truncate text-sm text-base-content/55">
                      <Trophy size={13} className="shrink-0 text-primary" aria-hidden="true" /> {e.winner_name ?? "–"}
                    </span>
                  </span>
                  <span className="text-right font-mono text-xs text-base-content/50">
                    <span className="block">{e.buy_in ? gbp(Number(e.buy_in)) : "Free"}</span>
                    <span className="block">{e.entries} cashes</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>

        <section className="panel overflow-hidden lg:col-span-5" aria-labelledby="festival-standings">
          <div className="border-b border-base-content/[0.07] px-6 py-5">
            <h2 id="festival-standings" className="font-display text-xl font-semibold tracking-tight">Festival leaderboard</h2>
            <p className="text-sm text-base-content/45">League points earned across this festival</p>
          </div>
          <table className="table w-full">
            <thead>
              <tr>
                <th className="w-12 pl-6 text-center">#</th>
                <th>Player</th>
                <th className="text-right">Events</th>
                <th className="pr-6 text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((p, i) => (
                <tr key={p.id} className={i < 3 ? "bg-primary/[0.035]" : ""}>
                  <td className="pl-6 text-center font-mono text-sm text-base-content/60">{i + 1}</td>
                  <td>
                    <Link href={`/players/${p.id}`} className="group flex items-center gap-3 font-medium">
                      <Initial name={p.name} />
                      <span className="truncate transition-colors group-hover:text-primary">{p.name}</span>
                    </Link>
                  </td>
                  <td className="text-right font-mono text-sm text-base-content/60">{p.events}</td>
                  <td className="pr-6 text-right font-mono text-sm font-semibold">{p.points.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}

function Headline({ label, value, small = false }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow">{label}</dt>
      <dd className={`mt-1 truncate font-display font-semibold tracking-tight ${small ? "text-lg leading-8" : "text-2xl"}`}>{value}</dd>
    </div>
  );
}
