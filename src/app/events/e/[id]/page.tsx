import Link from "next/link";
import { pageMeta } from "@/lib/site";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MapPin, Trophy } from "lucide-react";
import ShareButton from "@/components/ShareButton";
import JsonLd from "@/components/JsonLd";
import { SITE_URL } from "@/lib/site";
import { createSupabasePublicClient } from "@/lib/supabasePublic";
import { displayName } from "@/lib/nameMask";
import { venueHref } from "@/lib/venues";
import { TitleBand } from "@/components/tournaments/ComingUp";
import { Badge, eventTitle, festivalTitle } from "@/components/tournaments/SeasonCalendar";
import { getFestivalPhotos, getSiteImages } from "@/lib/siteImages";
import {
  type EventSummary, type SeriesRow, gbp, gbpShort, day, eventHref, festivalHref, seriesHref, shortEventName,
} from "@/lib/tournaments";

export const revalidate = 300;
// None built ahead: each page is rendered on its first visit, then served from cache.
export function generateStaticParams() {
  return [];
}

const h2 = "text-[clamp(1.3125rem,1.6vw,1.6875rem)] font-semibold leading-tight";
const ordinal = (n: number) => {
  const t = n % 100;
  return `${n}${t >= 11 && t <= 13 ? "th" : n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th"}`;
};
/** An event's own name within its festival, without the guarantee. */
const siblingName = (name: string | null) => shortEventName(name).split(/\s+[-–]\s+£/)[0].trim();

async function load(id: string) {
  const eventId = Number(id);
  if (!Number.isFinite(eventId)) return null;
  const supabase = createSupabasePublicClient();

  const { data: ev } = await supabase.from("event_summary").select("*").eq("id", eventId).maybeSingle();
  if (!ev) return null;

  const [{ data: series }, { data: festival }, { data: results }, { data: siblings }, { data: season }] = await Promise.all([
    ev.series_id
      ? supabase.from("series").select("*").eq("id", ev.series_id).maybeSingle()
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

/** A player's name, linked to their profile when there is one. */
function PlayerName({ id, name, className = "" }: { id?: number; name: string; className?: string }) {
  if (!id) return <span className={className}>{name}</span>;
  return <Link href={`/players/${id}`} className={`${className} decoration-current/40 underline-offset-4 hover:underline`}>{name}</Link>;
}

export default async function EventPage(props: { params: Promise<{ id: string }> }) {
  const img = await getSiteImages();
  const festivalPhotos = await getFestivalPhotos();
  const data = await load((await props.params).id);
  if (!data) notFound();
  const { ev, series, festival, rows, siblings, season } = data;
  const winner = rows.find((r) => r.position === 1);
  const placed = rows.filter((r) => r.position === 2 || r.position === 3).slice(0, 2);
  const showSiblings = siblings.length > 1 && series && festival;

  return (
    <div className="bg-season-night font-season text-season-ink">
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

      <TitleBand image={(ev.festival_id ? festivalPhotos.get(String(ev.festival_id)) : null) || series?.image_url || img.room_2} position="object-[55%_50%]">
        <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-x-2 text-[0.9375rem] font-medium text-season-ink/75">
          <Link href="/events" className="inline-flex min-h-11 items-center hover:text-season-ink">Tournaments</Link>
          {series && (
            <>
              <span aria-hidden="true" className="text-season-ink/40">/</span>
              <Link href={seriesHref(series)} className="inline-flex min-h-11 items-center hover:text-season-ink">{series.name}</Link>
            </>
          )}
          {series && festival && (
            <>
              <span aria-hidden="true" className="text-season-ink/40">/</span>
              <Link href={festivalHref(series, festival.id)} className="inline-flex min-h-11 items-center hover:text-season-ink">{festivalTitle(festival.label)}</Link>
            </>
          )}
        </nav>
        {series && <Badge series={series} className="h-8" />}
        <h1 className="mt-4 max-w-[22em] text-[clamp(2.25rem,3.8vw,4.5rem)] font-bold leading-[1.04] tracking-[-0.012em] text-balance">{eventTitle(ev.name)}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[clamp(1.0625rem,1.45vw,1.375rem)] font-medium text-season-muted">
          <span>{day(ev.start_date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
          {ev.casino && (
            <>
              <span aria-hidden="true">·</span>
              <MapPin size={18} aria-hidden="true" className="text-season-muted" />
              <Link href={venueHref(ev.casino)} className="hover:underline hover:decoration-season-ink/40 hover:underline-offset-4">{ev.casino}</Link>
            </>
          )}
        </p>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[1.0625rem] tabular-nums text-season-ink/65">
          <span>{ev.buy_in ? `${gbp(Number(ev.buy_in))} buy-in` : "Free to enter"}</span>
          <span aria-hidden="true">·</span>
          <span>{ev.entries} cashes</span>
          {season?.name && (
            <>
              <span aria-hidden="true">·</span>
              <span>{season.name}</span>
            </>
          )}
          {ev.is_high_roller && !/high roller/i.test(ev.name ?? "") && (
            <span className="ml-1 rounded-[3px] px-1.5 text-[0.8125rem] font-semibold text-season-ink/85 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.22)]">High Roller</span>
          )}
        </p>
      </TitleBand>

      <div className="space-y-[clamp(3rem,5vw,5rem)] px-4 pb-[clamp(2.5rem,4vw,4rem)] sm:px-[3.6vw]">
        {/* The podium: the winner leads, second and third follow quietly. */}
        {winner && (
          <section aria-labelledby="podium" className="flex flex-col border border-season-amber/60 bg-[linear-gradient(180deg,#14434a_0%,#0f3337_60%)] lg:flex-row">
            <div className="flex min-w-0 flex-1 items-center gap-5 px-5 py-6 sm:px-8">
              <Trophy size={34} strokeWidth={1.75} className="shrink-0 text-season-amber" aria-hidden="true" />
              <div className="min-w-0">
                <h2 id="podium" className="text-[1.0625rem] font-medium text-season-ink/75">Won by</h2>
                <p className="text-[clamp(1.75rem,2.8vw,2.75rem)] font-bold leading-[1.05] tracking-[-0.01em] text-season-amber [overflow-wrap:anywhere]">
                  <PlayerName id={winner.playerId} name={winner.name} />
                </p>
                <p className="mt-1 text-[0.9375rem] tabular-nums text-season-ink/75">
                  {winner.points.toFixed(2)} pts{winner.prize ? ` · ${gbp(winner.prize)}` : ""}
                </p>
              </div>
            </div>
            {placed.length > 0 && (
              <ol className="flex border-t border-white/[0.1] lg:border-l lg:border-t-0">
                {placed.map((r) => (
                  <li key={r.id} className="min-w-0 flex-1 border-white/[0.1] px-5 py-5 sm:px-8 lg:flex lg:w-[16rem] lg:flex-col lg:justify-center [&+&]:border-l">
                    <p className="text-[0.9375rem] text-season-muted">{r.position === 2 ? "Runner-up" : "Third"}</p>
                    <p className="truncate text-[1.1875rem] font-semibold"><PlayerName id={r.playerId} name={r.name} /></p>
                    <p className="text-[0.875rem] tabular-nums text-season-ink/70">{r.points.toFixed(2)} pts{r.prize ? ` · ${gbp(r.prize)}` : ""}</p>
                  </li>
                ))}
              </ol>
            )}
            <div className="flex items-center border-t border-white/[0.1] px-5 py-4 sm:px-8 lg:border-l lg:border-t-0">
              <ShareButton
                title={ev.name ?? "Tournament"}
                className="inline-flex h-11 items-center gap-2 rounded-[3px] border border-white/[0.14] px-4 text-[0.9375rem] font-medium text-season-ink transition-colors hover:border-white/30"
              />
            </div>
          </section>
        )}

        <div className={`grid gap-x-[clamp(2rem,4vw,4.5rem)] gap-y-14 ${showSiblings ? "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" : ""}`}>
          {/* Every cash */}
          <section aria-labelledby="results-heading" className="min-w-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <h2 id="results-heading" className={h2}>Results</h2>
              <span className="text-[0.9375rem] tabular-nums text-season-muted">
                {rows.length} {rows.length === 1 ? "cash" : "cashes"}
                {Number(ev.paid_out) > 0 && ` · ${gbpShort(Number(ev.paid_out))} paid out`}
              </span>
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full border-collapse text-left tabular-nums">
                <thead>
                  <tr className="border-b border-white/[0.12] text-[0.875rem] text-season-muted">
                    <th scope="col" className="w-16 pb-3 pr-3 font-medium">Finish</th>
                    <th scope="col" className="w-full pb-3 font-medium">Player</th>
                    <th scope="col" className="pb-3 pl-5 text-right font-medium">Prize</th>
                    <th scope="col" className="pb-3 pl-5 text-right font-medium">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const podium = r.position != null && r.position <= 3;
                    return (
                      <tr key={r.id} className="border-b border-white/[0.07] transition-colors hover:bg-white/[0.025]">
                        <td className={`pr-3 font-semibold ${podium ? "text-season-amber" : ""}`}>{r.position ? ordinal(r.position) : "–"}</td>
                        <td className="max-w-0">
                          <span className="block truncate py-3.5 text-[1.0625rem]">
                            <PlayerName id={r.playerId} name={r.name} className={podium ? "font-semibold" : ""} />
                          </span>
                        </td>
                        <td className="whitespace-nowrap pl-5 text-right text-season-ink/80">{r.prize ? gbp(r.prize) : <span className="text-season-muted">–</span>}</td>
                        <td className={`whitespace-nowrap pl-5 text-right font-semibold ${podium ? "text-season-amber" : ""}`}>
                          {r.points.toFixed(2)}
                          {r.penalty !== 0 && <span className="ml-1.5 text-[0.8125rem] font-normal text-season-down" title="Includes a penalty">({r.penalty})</span>}
                        </td>
                      </tr>
                    );
                  })}
                  {!rows.length && (
                    <tr><td colSpan={4} className="py-14 text-center text-season-ink/80">No results recorded for this event yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* The rest of the festival */}
          {showSiblings && (
            <aside aria-labelledby="festival-events" className="min-w-0">
              <div className="lg:sticky lg:top-8">
                <h2 id="festival-events" className="text-[clamp(1.3125rem,1.6vw,1.6875rem)] font-semibold leading-tight">
                  <Link href={festivalHref(series!, festival!.id)} className="decoration-season-ink/40 underline-offset-4 hover:underline">{festivalTitle(festival!.label)}</Link>
                </h2>
                <p className="mt-1 text-[0.9375rem] text-season-muted">Every event at this festival</p>
                <ol className="mt-5 border-t border-white/[0.12]">
                  {siblings.map((s) => {
                    const here = s.id === ev.id;
                    return (
                      <li key={s.id} className="border-b border-white/[0.07]">
                        <Link
                          href={eventHref(s.id)}
                          aria-current={here ? "page" : undefined}
                          className={`group flex items-center justify-between gap-4 py-3 pl-3 transition-colors ${here ? "bg-season-amber/[0.1]" : "hover:bg-white/[0.025]"}`}
                        >
                          <span className="min-w-0">
                            <span className={`block truncate text-[1rem] decoration-season-ink/40 underline-offset-4 group-hover:underline ${here ? "font-semibold" : "font-medium"}`}>{siblingName(s.name)}</span>
                            <span className="block truncate text-[0.875rem] text-season-amber">{s.winner_name ?? <span className="text-season-muted">–</span>}</span>
                          </span>
                          <span className="shrink-0 pr-1 text-[0.875rem] tabular-nums text-season-muted">{day(s.start_date)}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
