import Image from "next/image";
import Link from "next/link";
import { getFestivalPhotos, getSiteImages } from "@/lib/siteImages";
import { type EventSummary, type FestivalSummary, type SeriesRow, dateRange, day, eventHref, festivalHref } from "@/lib/tournaments";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Each series' own colour, taken from its logo, for its bars on the year ribbon. */
const SERIES_COLOUR: Record<string, string> = {
  gukpt: "#5ec8f2",
  ukpl: "#2f86e8",
  goliath: "#d9951f",
  g200: "#22cf78",
  g300: "#eab98a",
  "888poker-live": "#e9e6df",
  "uk-open": "#c9a0dc",
  behemoth: "#e0675a",
};
const colourFor = (slug: string | undefined) => (slug && SERIES_COLOUR[slug]) || "#93adac";


/** Event names carry their guarantee ("… - £50,000 GTD"); the money is not the story here. */
export const eventTitle = (name: string | null) => (name ?? "Event").split(/\s+[-–]\s+£/)[0].trim();
/** Festival labels end with " · Sep 2026"; the dates are shown on their own. */
export const festivalTitle = (label: string) => label.replace(/\s·\s\w{3}\s\d{4}$/, "");

/** A series logo at badge size, or its name when there is no logo yet. */
export function Badge({ series, className = "h-5" }: { series?: Pick<SeriesRow, "name" | "logo_url"> | null; className?: string }) {
  if (!series) return null;
  if (series.logo_url)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={series.logo_url} alt={series.name} className={`${className} w-auto max-w-[7rem] shrink-0 object-contain object-left`} />;
  return <span className="max-w-[5.5rem] shrink-0 text-[0.75rem] font-bold uppercase leading-tight tracking-wide text-season-ink/80">{series.name}</span>;
}

const monthOf = (d: string | null) => (d ? new Date(d).getMonth() : -1);

/**
 * The season at a glance: the year as twelve months, one lane per series. Festivals are bars over their
 * dates in the series' colour; single events are ticks. A month opens its chapter further down.
 */
export function YearRibbon({
  year, series, festivals, singles, current, chapters,
}: {
  year: number;
  series: SeriesRow[];
  festivals: FestivalSummary[];
  singles: EventSummary[];
  current: number | null;
  chapters: Set<number>;
}) {
  const start = Date.UTC(year, 0, 1);
  const span = Date.UTC(year + 1, 0, 1) - start;
  const at = (d: string) => Math.min(100, Math.max(0, ((new Date(`${d.slice(0, 10)}T00:00:00Z`).getTime() - start) / span) * 100));

  const lanes = series
    .map((s) => ({
      s,
      fests: festivals.filter((f) => f.series_id === s.id),
      ticks: singles.filter((e) => e.series_id === s.id && e.start_date),
    }))
    .filter((l) => l.fests.length || l.ticks.length);
  const otherTicks = singles.filter((e) => e.start_date && !series.some((s) => s.id === e.series_id));

  return (
    <>
    <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="min-w-[52rem]">
        {/* Months */}
        <div className="grid grid-cols-[7.5rem_1fr]">
          <span className="sticky left-0 z-10 shadow-[-1rem_0_0_var(--color-season-night)] sm:shadow-none bg-season-night" />
          <ol className="grid grid-cols-12">
            {MONTHS.map((m, i) => {
              const label = m.slice(0, 3);
              const on = i === current;
              const cls = `flex h-11 items-center justify-center rounded-[3px] text-[0.9375rem] transition-colors ${
                on ? "font-semibold text-season-ink shadow-[inset_0_0_0_1px_var(--color-season-amber)]" : chapters.has(i) ? "text-season-ink/80 hover:bg-white/[0.05] hover:text-season-ink" : "text-season-muted/60"
              }`;
              return (
                <li key={m}>
                  {chapters.has(i) ? (
                    <a href={`#m-${i}`} className={cls} aria-label={`${m}: jump to the month`}>{label}</a>
                  ) : (
                    <span className={cls}>{label}</span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        {/* Lanes */}
        <ul className="mt-1 border-t border-white/[0.08]">
          {lanes.map(({ s, fests, ticks }) => (
            <li key={s.id} className="grid h-10 grid-cols-[7.5rem_1fr] items-center border-b border-white/[0.06]">
              <Link href={`/events/${s.slug}`} className="sticky left-0 z-10 shadow-[-1rem_0_0_var(--color-season-night)] sm:shadow-none flex h-full items-center bg-season-night pr-3" aria-label={`${s.name} series`}>
                <Badge series={s} className="h-[1.125rem]" />
              </Link>
              <div className="relative h-full bg-[linear-gradient(to_right,rgb(255_255_255/0.05)_1px,transparent_1px)] bg-[size:calc(100%/12)_100%]">
                {ticks.map((e) => (
                  <span
                    key={e.id}
                    aria-hidden="true"
                    className="absolute top-1/2 h-3 w-[2px] -translate-y-1/2 rounded-full opacity-80"
                    style={{ left: `${at(e.start_date!)}%`, background: colourFor(s.slug) }}
                  />
                ))}
                {fests.map((f) => (
                  <Link
                    key={f.id}
                    href={festivalHref(s, f.id)}
                    title={`${festivalTitle(f.label)} · ${dateRange(f.start_date, f.end_date)}`}
                    className="absolute top-1/2 h-2.5 min-w-2 -translate-y-1/2 rounded-full transition-[filter] hover:brightness-125 focus-visible:outline-offset-4"
                    style={{ left: `${at(f.start_date)}%`, width: `${Math.max(0.6, at(f.end_date) - at(f.start_date))}%`, background: colourFor(s.slug) }}
                  >
                    <span className="sr-only">{festivalTitle(f.label)}, {dateRange(f.start_date, f.end_date)}</span>
                  </Link>
                ))}
              </div>
            </li>
          ))}
          {otherTicks.length > 0 && (
            <li className="grid h-10 grid-cols-[7.5rem_1fr] items-center border-b border-white/[0.06]">
              <span className="sticky left-0 z-10 shadow-[-1rem_0_0_var(--color-season-night)] sm:shadow-none flex h-full items-center bg-season-night text-[0.875rem] text-season-muted">Other</span>
              <div className="relative h-full">
                {otherTicks.map((e) => (
                  <span key={e.id} aria-hidden="true" className="absolute top-1/2 h-3 w-[2px] -translate-y-1/2 rounded-full bg-season-muted/70" style={{ left: `${at(e.start_date!)}%` }} />
                ))}
              </div>
            </li>
          )}
        </ul>
      </div>
    </div>
    <p className="mt-3 text-[0.875rem] text-season-muted">
      Bars are festivals, ticks are single events. Pick a month to jump to it.
      <span className="sm:hidden"> Swipe for the rest of the year.</span>
    </p>
    </>
  );
}

/** One month of the season: its name set large, its festivals as strips, its single events as one-line rows. */
export function MonthChapter({
  month, festivals, singles, seriesById, stillOffset,
}: {
  month: number;
  festivals: FestivalSummary[];
  singles: EventSummary[];
  seriesById: Map<number, SeriesRow>;
  stillOffset: number;
}) {
  return (
    <section id={`m-${month}`} aria-labelledby={`m-${month}-h`} className="scroll-mt-28 border-t border-white/[0.08] pt-[clamp(1.5rem,2.5vw,2.25rem)] lg:grid lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-x-[clamp(2rem,3vw,3rem)]">
      {/* The name and its count travel together while the month scrolls past. */}
      <div className="self-start lg:sticky lg:top-8">
        <h3 id={`m-${month}-h`} className="text-[clamp(1.875rem,2.8vw,2.75rem)] font-bold leading-none tracking-[-0.01em]">
          {MONTHS[month]}
        </h3>
        <p className="mt-2 text-[0.9375rem] text-season-muted">
          {[festivals.length && `${festivals.length} ${festivals.length === 1 ? "festival" : "festivals"}`, singles.length && `${singles.length} single ${singles.length === 1 ? "event" : "events"}`].filter(Boolean).join(" · ")}
        </p>
      </div>

      <div className="mt-5 min-w-0 space-y-4 lg:mt-0">
        {festivals.map((f, i) => (
          <FestivalStrip key={f.id} festival={f} series={f.series_id ? seriesById.get(f.series_id) : undefined} still={stillOffset + i} />
        ))}
        {singles.length > 0 && <EventRows events={singles} seriesById={seriesById} className={festivals.length ? "pt-2" : ""} />}
      </div>
    </section>
  );
}

/** A festival as a wide strip: still, series logo, name, dates and venue, Main Event winner, number of events. */
export async function FestivalStrip({ festival: f, series: s, still = 0, badge = true }: { festival: FestivalSummary; series?: SeriesRow; still?: number; badge?: boolean }) {
  // The festival's own photo, else its series photo, else the general room photos in rotation (all set in admin).
  const [img, festivalPhotos] = await Promise.all([getSiteImages(), getFestivalPhotos()]);
  const photo = festivalPhotos.get(String(f.id)) || s?.image_url || img.rooms[still % img.rooms.length];
  const body = (
    <>
      <div className="relative hidden w-[clamp(8rem,14vw,12rem)] shrink-0 self-stretch overflow-hidden sm:block">
        <Image src={photo} alt="" fill sizes="12rem" className="object-cover" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:gap-6">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          {badge && <Badge series={s} className="h-6" />}
          <div className="min-w-0">
            <p className="truncate text-[1.1875rem] font-semibold decoration-season-ink/40 underline-offset-4 group-hover:underline">{festivalTitle(f.label)}</p>
            <p className="truncate text-[0.9375rem] text-season-muted">
              {dateRange(f.start_date, f.end_date)}
              {f.casino && ` · ${f.casino}`}
            </p>
          </div>
        </div>
        {f.main_event_winner && (
          <p className="min-w-0 text-[0.9375rem] md:w-[16rem] md:border-l md:border-white/[0.1] md:pl-6">
            <span className="block text-season-muted">Main Event</span>
            <span className="block truncate font-semibold text-season-amber">{f.main_event_winner}</span>
          </p>
        )}
        <p className="shrink-0 text-[0.9375rem] tabular-nums text-season-muted md:w-20 md:border-l md:border-white/[0.1] md:pl-6 md:text-center">
          <span className="text-[1.25rem] font-semibold text-season-ink md:block">{f.events}</span> events
        </p>
      </div>
    </>
  );
  const cls = "group flex overflow-hidden border border-white/[0.08] bg-[linear-gradient(180deg,#14434a_0%,#0f3337_60%)] transition-colors hover:border-white/20";
  return s ? <Link href={festivalHref(s, f.id)} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}

/** Single events as one-line rows: date, series logo, event, winner. */
export function EventRows({ events, seriesById, className = "", badge = true, year = false }: {
  events: EventSummary[];
  seriesById?: Map<number, SeriesRow>;
  className?: string;
  badge?: boolean;
  year?: boolean;
}) {
  const cols = badge
    ? "grid-cols-[3.75rem_5.5rem_minmax(0,1fr)] sm:grid-cols-[4.5rem_6rem_minmax(0,1fr)_minmax(0,14rem)]"
    : year
      ? "grid-cols-[6rem_minmax(0,1fr)] sm:grid-cols-[7rem_minmax(0,1fr)_minmax(0,14rem)]"
      : "grid-cols-[3.75rem_minmax(0,1fr)] sm:grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,14rem)]";
  return (
    <ul className={className}>
      {events.map((e) => {
        const s = badge && e.series_id ? seriesById?.get(e.series_id) : undefined;
        return (
          <li key={e.id} className="border-b border-white/[0.06]">
            <Link href={eventHref(e.id)} className={`group grid items-center gap-x-4 py-2.5 text-[0.9375rem] ${cols}`}>
              <span className="tabular-nums text-season-muted">{day(e.start_date, year ? { day: "numeric", month: "short", year: "numeric" } : undefined)}</span>
              {badge && <span className="flex">{s ? <Badge series={s} className="h-[1.125rem]" /> : null}</span>}
              <span className="min-w-0">
                <span className="block truncate font-medium decoration-season-ink/40 underline-offset-4 group-hover:underline">{eventTitle(e.name)}</span>
                {e.winner_name && <span className="block truncate text-season-amber sm:hidden">{e.winner_name}</span>}
              </span>
              <span className="hidden truncate text-right font-semibold text-season-amber sm:block">{e.winner_name ?? <span className="font-normal text-season-muted">–</span>}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export { MONTHS, monthOf };
