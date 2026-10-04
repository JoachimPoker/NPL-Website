import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { type getHomeExtras } from "@/components/home/HomeExtras";
import { eventHref, festivalHref } from "@/lib/tournaments";
import { getFestivalPhotos, getSiteImages } from "@/lib/siteImages";
import { venueHref } from "@/lib/venues";

type Extras = Awaited<ReturnType<typeof getHomeExtras>>;
export type Gainer = { player_id: string; display_name: string; from_pos: number; to_pos: number; delta: number; is_anonymized?: boolean };
export type Trending = { player_id: string; hits: number; display_name: string; is_anonymized?: boolean };

/** Home-page title for a tournament: the prize-pool suffix ("- £15,000 GTD") is dropped, the league celebrates play, not money. */
const playTitle = (name: string | null) => (name ?? "Tournament").replace(/\s*[-–]\s*£[\d,.]+\s*(?:GTD)?\s*$/i, "").trim();

/**
 * Atmosphere stills for tiles and thumbnails. Generated stand-ins (no real venues, no people): they set the
 * mood, they never claim to show a particular casino. Replace with real event photography when available.
 */

const dayMonth = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : "–";
const dayMonthYear = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "–";
function range(start: string | null | undefined, end: string | null | undefined) {
  if (!start) return "";
  if (!end || end.slice(0, 10) === start.slice(0, 10)) return dayMonthYear(start);
  return `${dayMonth(start)} – ${dayMonthYear(end)}`;
}

function SectionTitle({ id, title, line, link }: { id: string; title: string; line?: string; link?: { href: string; label: string } }) {
  return (
    <div className="mb-[clamp(1.25rem,1.8vw,2rem)] flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div>
        <h2 id={id} className="text-[clamp(1.875rem,2.67vw,2.75rem)] font-semibold leading-[1.1] tracking-[0.01em] text-season-ink">
          {title}
        </h2>
        {line && <p className="mt-1.5 text-[clamp(1rem,1.15vw,1.125rem)] text-season-muted">{line}</p>}
      </div>
      {link && (
        <Link href={link.href} className="group inline-flex min-h-11 items-center gap-2 text-[clamp(1rem,1.05vw,1.0625rem)] font-medium text-season-ink">
          {link.label}
          <ArrowRight size={17} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

/* ---------------- This week: a film-still band ---------------- */

export async function ThisWeek({ gainers: allGainers }: { gainers: Gainer[]; trending?: Trending[] }) {
  const img = await getSiteImages();
  // Players who have not agreed to be named are left out entirely (GDPR).
  const gainers = allGainers.filter((g) => !g.is_anonymized).slice(0, 3);
  if (!gainers.length) return null;
  return (
    <section aria-labelledby="week-heading" className="relative isolate overflow-hidden bg-season-night text-season-ink">
      <Image src={img.home_week} alt="" fill sizes="100vw" className="-z-10 object-cover object-left" />
      {/* Darken towards the figures on the right; on phones the whole band darkens under the stacked list. */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-season-night/30 via-season-night/70 to-season-night/95 max-md:bg-season-night/75" />
      <div className="grid gap-8 px-4 py-[clamp(3rem,5vw,5.5rem)] sm:px-[3.6vw] md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)] md:items-center">
        <div>
          <h2 id="week-heading" className="text-[clamp(2.5rem,4.3vw,5rem)] font-bold leading-[1.02] tracking-[-0.01em]">
            This week
          </h2>
          <p className="mt-2 text-[clamp(1rem,1.15vw,1.125rem)] text-season-ink/80">The biggest climbers since the last update</p>
        </div>
        <ol className="grid gap-6 sm:grid-cols-3 sm:gap-0">
          {gainers.map((g, i) => (
            <li key={g.player_id} className={`sm:px-[clamp(1rem,2vw,2.25rem)] ${i > 0 ? "sm:border-l sm:border-season-ink/20" : "sm:pl-0"}`}>
              <p className="text-[clamp(2.75rem,4.4vw,4.75rem)] font-bold leading-none tabular-nums text-season-amber">
                <span aria-hidden="true">+</span>
                <span className="sr-only">Up </span>
                {g.delta}
                <span className="sr-only"> places</span>
              </p>
              <Link
                href={`/players/${g.player_id}`}
                className="mt-2 inline-block text-[clamp(1.125rem,1.45vw,1.5rem)] font-semibold leading-snug hover:underline hover:decoration-season-ink/40 hover:underline-offset-4"
              >
                {g.display_name}
              </Link>
              <p className="tabular-nums text-season-ink/75">
                {g.from_pos} <span aria-hidden="true">→</span>
                <span className="sr-only">to</span> {g.to_pos}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------------- This season: photo-led festival tiles ---------------- */

export async function ThisSeason({ extras }: { extras: Extras }) {
  // Each festival's own photo, else its series photo, else the room photos in rotation (all set in admin).
  const [img, festivalPhotos] = await Promise.all([getSiteImages(), getFestivalPhotos()]);
  const still = (i: number) => img.rooms[i % img.rooms.length];
  const { festivals, upcoming, seriesNames } = extras;
  if (!festivals.length && !upcoming.length) return null;
  return (
    <section aria-labelledby="season-heading" className="bg-season-night px-4 pt-[clamp(3rem,4.6vw,5rem)] sm:px-[3.6vw]">
      <SectionTitle id="season-heading" title="This season" link={{ href: "/events", label: "All tournaments" }} />
      <div className={upcoming.length ? "grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" : "grid gap-6"}>
        {festivals.length > 0 && (
          <ul className={upcoming.length || festivals.length < 3 ? "grid gap-6 sm:grid-cols-2" : "grid gap-6 sm:grid-cols-2 lg:grid-cols-3"}>
            {festivals.map(({ festival: f, series: s }, i) => (
              <li key={f.id}>
                <Link href={festivalHref(s, f.id)} className="group relative isolate flex aspect-[16/10] flex-col justify-end overflow-hidden border border-white/[0.08] p-6 sm:aspect-[16/9]">
                  <Image src={festivalPhotos.get(String(f.id)) || s.image_url || still(i)} alt="" fill sizes="(min-width: 640px) 50vw, 100vw" className="-z-10 object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]" />
                  <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-season-night via-season-night/70 via-45% to-season-night/10" />
                  <h3 className="text-[clamp(1.5rem,1.9vw,2rem)] font-semibold leading-[1.08] text-season-ink">{f.label}</h3>
                  <p className="mt-1.5 text-[clamp(1rem,1.15vw,1.125rem)] text-season-ink/85">
                    {s.name} festival · {range(f.start_date, f.end_date)}
                  </p>
                  {f.main_event_winner && (
                    <p className="text-[clamp(1rem,1.15vw,1.125rem)] text-season-ink/85">
                      Main Event won by <span className="font-semibold text-season-ink">{f.main_event_winner}</span>
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}

        {upcoming.length > 0 && (
          <div className="border border-white/[0.08] bg-season-card px-5 pb-2 pt-5 sm:px-6">
            <h3 className="text-[1.25rem] font-semibold text-season-ink">Coming up</h3>
            <ol className="mt-3">
              {upcoming.map((u) => (
                <li key={u.id} className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-4 border-t border-white/[0.12] py-4">
                  <p className="text-center leading-none">
                    <span className="block text-[1.75rem] font-bold tabular-nums text-season-ink">
                      {new Date(u.start_date).toLocaleDateString("en-GB", { day: "numeric", timeZone: "UTC" })}
                    </span>
                    <span className="mt-1 block text-[0.8125rem] font-semibold uppercase tracking-[0.12em] text-season-muted">
                      {new Date(u.start_date).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}
                    </span>
                  </p>
                  <div className="min-w-0">
                    <p className="text-[1.0625rem] font-semibold leading-snug text-season-ink">{u.title}</p>
                    <p className="text-[0.9375rem] text-season-muted">
                      {u.series_id && seriesNames.get(u.series_id) ? `${seriesNames.get(u.series_id)} · ` : ""}
                      {u.casino ? (
                        <Link href={venueHref(u.casino)} className="hover:text-season-ink">{u.casino}</Link>
                      ) : (
                        u.city
                      )}
                      {u.end_date && u.end_date !== u.start_date ? ` · until ${dayMonth(u.end_date)}` : ""}
                    </p>
                    {u.url && (
                      <a href={u.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-[0.9375rem] font-medium text-season-ink hover:underline hover:underline-offset-4">
                        Details
                        <ArrowUpRight size={15} aria-hidden="true" />
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------------- Latest results: rows with a still ---------------- */

export async function LatestResults({ extras }: { extras: Extras }) {
  // A result shows its festival's photo, else its series photo, else a room photo.
  const [img, festivalPhotos] = await Promise.all([getSiteImages(), getFestivalPhotos()]);
  const still = (i: number) => img.rooms[i % img.rooms.length];
  if (!extras.latest.length) return null;
  return (
    <section aria-labelledby="results-heading" className="bg-season-night px-4 pt-[clamp(3rem,4.6vw,5rem)] sm:px-[3.6vw]">
      <SectionTitle
        id="results-heading"
        title="Latest results"
        line={extras.stats.updatedTo ? `Results up to ${dayMonthYear(extras.stats.updatedTo)}` : undefined}
        link={{ href: "/events", label: "All results" }}
      />
      <ol className="grid gap-3">
        {extras.latest.map(({ event: e, series }, i) => (
          <li key={e.id}>
            <Link
              href={eventHref(e.id)}
              className="group grid grid-cols-[6.5rem_minmax(0,1fr)] items-stretch overflow-hidden border border-white/[0.08] bg-season-card transition-colors hover:bg-[#123d42] sm:grid-cols-[11rem_minmax(0,1fr)]"
            >
              <span className="relative block min-h-[5.25rem]">
                <Image src={(e.festival_id ? festivalPhotos.get(String(e.festival_id)) : null) || series?.image_url || still(i + 2)} alt="" fill sizes="176px" className="object-cover" />
              </span>
              <span className="flex min-w-0 flex-col justify-center gap-0.5 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-7">
                <span className="min-w-0">
                  <span className="block truncate text-[clamp(1.0625rem,1.35vw,1.375rem)] font-semibold text-season-ink group-hover:underline group-hover:decoration-season-ink/40 group-hover:underline-offset-4">
                    {playTitle(e.name)}
                  </span>
                  <span className="block truncate text-[0.9375rem] text-season-muted">
                    {[dayMonthYear(e.start_date), series?.name, e.casino].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {e.winner_name && (
                  <span className="shrink-0 text-[clamp(0.9375rem,1.1vw,1.0625rem)] text-season-muted sm:text-right">
                    Won by <span className="font-semibold text-season-ink">{e.winner_name}</span>
                  </span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ---------------- News ---------------- */

export function News({ extras }: { extras: Extras }) {
  if (!extras.news.length) return null;
  return (
    <section aria-labelledby="news-heading" className="bg-season-night px-4 pt-[clamp(3rem,4.6vw,5rem)] sm:px-[3.6vw]">
      <SectionTitle id="news-heading" title="News" link={{ href: "/news", label: "All news" }} />
      <ul className="grid gap-6 md:grid-cols-3">
        {extras.news.map((n: any) => (
          <li key={n.id}>
            <Link href={`/news/${n.id}`} className="group flex h-full flex-col border border-white/[0.08] bg-season-card p-6 transition-colors hover:bg-[#123d42]">
              <h3 className="text-[1.375rem] font-semibold leading-snug text-season-ink group-hover:underline group-hover:decoration-season-ink/40 group-hover:underline-offset-4">
                {n.title}
              </h3>
              <p className="mt-1.5 text-[0.9375rem] text-season-muted">
                {dayMonthYear(n.published_at)}
                {n.category ? ` · ${n.category}` : ""}
              </p>
              {n.excerpt && <p className="mt-2 line-clamp-3 text-[1.0625rem] leading-relaxed text-season-ink/80">{n.excerpt}</p>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
