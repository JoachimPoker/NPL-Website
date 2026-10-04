import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { type SeriesRow, dateRange } from "@/lib/tournaments";
import { type UpcomingEvent, venueHref } from "@/lib/venues";
import { getSiteImages } from "@/lib/siteImages";
import { Badge } from "@/components/tournaments/SeasonCalendar";

const h2 = "text-[clamp(1.5rem,1.9vw,2rem)] font-semibold leading-tight";
const DAY = 86_400_000;

/** "Starts in 5 days" / "Starts tomorrow" / "On now", counted in whole days. */
function startsIn(u: UpcomingEvent, today: string) {
  if (u.start_date <= today) return "On now";
  const days = Math.round((Date.parse(`${u.start_date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY);
  return days === 1 ? "Starts tomorrow" : `Starts in ${days} days`;
}

/**
 * The page's opening still, across the full width, darkening gently on the left behind the title. Stills are generated stand-ins (no real people); swap in real photography.
 */
export function TitleBand({ image, children, position = "object-[70%_40%]", zoom = "" }: { image: string; children: React.ReactNode; position?: string; zoom?: string }) {
  return (
    <section className="relative isolate flex min-h-[clamp(19rem,23vw,24rem)] items-end overflow-hidden">
      {/* The photo runs the full width; it only darkens gently on the left, behind the title. */}
      <Image src={image} alt="" fill priority sizes="100vw" className={`-z-10 object-cover ${position} ${zoom}`} />
      <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-10 h-28 bg-gradient-to-b from-season-night/60 to-transparent" />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-[55%] bg-gradient-to-t from-season-night via-season-night/55 to-transparent" />
      <div aria-hidden="true" className="absolute inset-y-0 left-0 -z-10 w-full bg-gradient-to-r from-season-night/80 via-season-night/35 via-45% to-transparent to-75%" />
      <div className="rise w-full px-4 pb-[clamp(2rem,3vw,3rem)] pt-[7.25rem] sm:px-[3.6vw]">{children}</div>
    </section>
  );
}

/** Coming up: the next festival or event leads as a large strip, the few after it follow as slim rows. */
export async function ComingUp({ items, seriesById, title = "Coming up" }: { items: UpcomingEvent[]; seriesById: Map<number, SeriesRow>; title?: string }) {
  const [next, ...later] = items;
  if (!next) return null;
  const today = new Date().toISOString().slice(0, 10);
  const img = await getSiteImages();
  const photo = (next.series_id ? seriesById.get(next.series_id)?.image_url : null) || img.room_1;
  return (
    <section aria-labelledby="coming-up">
      <h2 id="coming-up" className={h2}>{title}</h2>
      <div className="mt-5 flex overflow-hidden border border-season-amber/70 bg-[linear-gradient(180deg,#14434a_0%,#0f3337_60%)]">
        <div className="relative hidden w-[clamp(14rem,28vw,26rem)] shrink-0 sm:block">
          <Image src={photo} alt="" fill sizes="26rem" className="object-cover" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-5 px-5 py-6 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <Badge series={next.series_id ? seriesById.get(next.series_id) : null} className="h-7" />
            <p className="mt-3 text-[clamp(1.75rem,2.8vw,2.75rem)] font-bold leading-[1.05] tracking-[-0.01em]">{next.title}</p>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[1.0625rem] text-season-ink/80">
              <span className="tabular-nums">{dateRange(next.start_date, next.end_date)}</span>
              {(next.casino || next.city) && (
                <>
                  <span aria-hidden="true">·</span>
                  <MapPin size={16} aria-hidden="true" className="text-season-muted" />
                  {next.casino ? <Link href={venueHref(next.casino)} className="hover:underline">{next.casino}</Link> : next.city}
                </>
              )}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-3 md:items-end">
            <p className="text-[1.25rem] font-semibold text-season-amber">{startsIn(next, today)}</p>
            {next.url && (
              <a
                href={next.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-[2.95rem] items-center gap-2.5 rounded-[3px] bg-season-amber px-[1.4rem] font-semibold text-season-amber-ink transition-colors hover:bg-[#f6b45a]"
              >
                See the schedule
                <ArrowRight size={18} strokeWidth={2.25} aria-hidden="true" />
                <span className="sr-only">(opens the organiser&apos;s site)</span>
              </a>
            )}
          </div>
        </div>
      </div>
      {later.length > 0 && (
        <ul className="border-x border-b border-white/[0.08]">
          {later.map((u) => (
            <li key={u.id} className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-x-4 border-t border-white/[0.06] px-5 py-3 text-[0.9375rem] sm:grid-cols-[6rem_9rem_minmax(0,1fr)_auto] sm:px-8">
              <span className="flex">{u.series_id && <Badge series={seriesById.get(u.series_id)} className="h-[1.125rem]" />}</span>
              <span className="tabular-nums text-season-muted sm:order-first">{dateRange(u.start_date, u.end_date)}</span>
              <span className="col-span-2 truncate font-medium sm:col-span-1">{u.title}</span>
              <span className="hidden truncate text-season-muted sm:block">{u.casino ?? u.city}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
