import Link from "next/link";
import { pageMeta } from "@/lib/site";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Trophy, Medal } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import ShareButton from "@/components/ShareButton";
import JsonLd from "@/components/JsonLd";
import { SITE_URL } from "@/lib/site";
import { Initial } from "@/components/HomeLeaderboard";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { displayName } from "@/lib/nameMask";
import { venueHref } from "@/lib/venues";
import {
  type EventSummary, type SeriesRow, gbp, gbpShort, day, eventHref, festivalHref, seriesHref, shortEventName,
} from "@/lib/tournaments";

export const revalidate = 300;

async function load(id: string) {
  const eventId = Number(id);
  if (!Number.isFinite(eventId)) return null;
  const supabase = await createSupabaseServerClient();

  const { data: ev } = await supabase.from("event_summary").select("*").eq("id", eventId).maybeSingle();
  if (!ev) return null;

  const [{ data: series }, { data: festival }, { data: results }, { data: siblings }, { data: season }] = await Promise.all([
    ev.series_id
      ? supabase.from("series").select("id, name, slug, description, logo_url, has_festivals, sort_order").eq("id", ev.series_id).maybeSingle()
      : Promise.resolve({ data: null }),
    ev.festival_id
      ? supabase.from("festivals").select("id, label").eq("id", ev.festival_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("results")
      .select("id, finish_position, points, penalty_points, prize_amount, player:players(id, forename, surname, display_name, gdpr)")
      .eq("event_id", eventId)
      .eq("is_deleted", false)
      .order("finish_position", { ascending: true }),
    ev.festival_id
      ? supabase.from("event_summary").select("*").eq("festival_id", ev.festival_id).order("start_date")
      : Promise.resolve({ data: [] as EventSummary[] }),
    ev.season_id ? supabase.from("seasons").select("name").eq("id", ev.season_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const rows = (results || []).map((r: any) => ({
    id: r.id as number,
    position: r.finish_position as number | null,
    points: Number(r.points) + Number(r.penalty_points || 0),
    penalty: Number(r.penalty_points || 0),
    prize: Number(r.prize_amount || 0),
    playerId: r.player?.id as number | undefined,
    name: displayName(r.player?.forename, r.player?.surname, !!r.player?.gdpr, r.player?.display_name),
  }));

  return { ev: ev as EventSummary, series: series as SeriesRow | null, festival, rows, siblings: (siblings || []) as EventSummary[], season };
}

export async function generateMetadata(props: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const data = await load((await props.params).id);
  if (!data) return { title: "Tournament" };
  const { ev, rows } = data;
  const winner = rows.find((r) => r.position === 1)?.name;
  return pageMeta({
    title: ev.name ?? "Tournament",
    description: [
      ev.casino,
      day(ev.start_date, { day: "numeric", month: "long", year: "numeric" }),
      winner ? `won by ${winner}` : null,
      `${ev.entries} cashes, ${gbpShort(Number(ev.paid_out))} paid out`,
    ].filter(Boolean).join(" · "),
    path: eventHref(ev.id),
  });
}

export default async function EventPage(props: { params: Promise<{ id: string }> }) {
  const data = await load((await props.params).id);
  if (!data) notFound();
  const { ev, series, festival, rows, siblings, season } = data;
  const podium = rows.filter((r) => r.position && r.position <= 3).slice(0, 3);

  return (
    <>
      <JsonLd
        data={{
          "@type": "SportsEvent",
          name: ev.name ?? "Tournament",
          sport: "Poker",
          startDate: ev.start_date ?? undefined,
          eventStatus: "https://schema.org/EventScheduled",
          url: `${SITE_URL}${eventHref(ev.id)}`,
          ...(ev.casino ? { location: { "@type": "Place", name: ev.casino, address: ev.casino } } : {}),
          ...(ev.buy_in ? { offers: { "@type": "Offer", price: Number(ev.buy_in), priceCurrency: "GBP" } } : {}),
        }}
      />
      <PageHeader
        eyebrow={
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2">
            <Link href="/events" className="hover:text-primary">Tournaments</Link>
            {series && (<><span className="text-base-content/30">/</span><Link href={seriesHref(series)} className="hover:text-primary">{series.name}</Link></>)}
            {series && festival && (
              <><span className="text-base-content/30">/</span><Link href={festivalHref(series, festival.id)} className="hover:text-primary">{festival.label}</Link></>
            )}
          </nav>
        }
        title={ev.name ?? "Tournament"}
        description={
          <>
            {ev.casino ? <Link href={venueHref(ev.casino)} className="hover:text-primary">{ev.casino}</Link> : "Unknown venue"}
            {` · ${day(ev.start_date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}${season?.name ? ` · ${season.name}` : ""}`}
          </>
        }
        actions={<ShareButton title={ev.name ?? "Tournament"} />}
      >
        <dl className="grid max-w-3xl grid-cols-2 gap-6 sm:grid-cols-4">
          <Headline label="Buy-in" value={ev.buy_in ? gbp(Number(ev.buy_in)) : "Free"} />
          <Headline label="Cashes" value={String(ev.entries)} />
          <Headline label="Paid out" value={gbpShort(Number(ev.paid_out))} />
          <Headline label="Winner won" value={ev.winner_prize ? gbp(Number(ev.winner_prize)) : "–"} />
        </dl>
        {ev.is_high_roller && <span className="badge badge-secondary mt-6">High Roller event</span>}
      </PageHeader>

      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-12 lg:px-8">
        <div className="space-y-10 lg:col-span-8">
          {podium.length > 0 && (
            <section aria-label="Podium" className="grid gap-4 sm:grid-cols-3">
              {podium.map((r) => (
                <div key={r.id} className={`panel p-5 ${r.position === 1 ? "ring-1 ring-primary/40" : ""}`}>
                  <div className="flex items-center gap-2 text-sm text-base-content/55">
                    {r.position === 1
                      ? <Trophy size={16} className="text-primary" aria-hidden="true" />
                      : <Medal size={16} aria-hidden="true" />}
                    {r.position === 1 ? "Winner" : r.position === 2 ? "Runner-up" : "Third"}
                  </div>
                  <Link href={`/players/${r.playerId}`} className="mt-2 block truncate font-display text-xl font-semibold hover:text-primary">
                    {r.name}
                  </Link>
                  <div className="mt-1 font-mono text-sm text-base-content/60">
                    {r.prize ? gbp(r.prize) : "–"} · {r.points.toFixed(2)} pts
                  </div>
                </div>
              ))}
            </section>
          )}

          <section className="panel overflow-hidden" aria-labelledby="results-heading">
            <div className="flex items-center justify-between border-b border-base-content/[0.07] px-6 py-5">
              <h2 id="results-heading" className="font-display text-xl font-semibold tracking-tight">Results</h2>
              <span className="text-sm text-base-content/45">{rows.length} cashes</span>
            </div>
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th className="w-16 pl-6 text-center">#</th>
                    <th>Player</th>
                    <th className="text-right">Prize</th>
                    <th className="pr-6 text-right">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="transition-colors hover:bg-base-content/[0.03]">
                      <td className="pl-6 text-center font-mono text-sm text-base-content/60">{r.position ?? "–"}</td>
                      <td>
                        <Link href={`/players/${r.playerId}`} className="group flex items-center gap-3 font-medium">
                          <Initial name={r.name} />
                          <span className="transition-colors group-hover:text-primary">{r.name}</span>
                        </Link>
                      </td>
                      <td className="text-right font-mono text-sm">{r.prize ? gbp(r.prize) : <span className="text-base-content/30">–</span>}</td>
                      <td className="pr-6 text-right font-mono text-sm font-semibold">
                        {r.points.toFixed(2)}
                        {r.penalty !== 0 && <span className="ml-1 text-xs font-normal text-error" title="Includes a penalty">({r.penalty})</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {siblings.length > 1 && series && festival && (
          <aside className="lg:col-span-4" aria-labelledby="festival-events">
            <div className="panel sticky top-24 overflow-hidden">
              <div className="border-b border-base-content/[0.07] px-5 py-4">
                <div className="eyebrow">This festival</div>
                <Link href={festivalHref(series, festival.id)} id="festival-events" className="font-display text-lg font-semibold hover:text-primary">
                  {festival.label}
                </Link>
              </div>
              <ol className="divide-y divide-base-content/[0.06]">
                {siblings.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={eventHref(s.id)}
                      aria-current={s.id === ev.id ? "page" : undefined}
                      className={`flex items-center justify-between gap-3 px-5 py-3 text-sm transition-colors hover:bg-base-content/[0.03] ${
                        s.id === ev.id ? "bg-primary/[0.06] text-primary" : ""
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{shortEventName(s.name)}</span>
                        <span className="block truncate text-xs text-base-content/45">{s.winner_name ?? "–"}</span>
                      </span>
                      <span className="shrink-0 font-mono text-xs text-base-content/45">{day(s.start_date)}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        )}
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
