import Link from "next/link";
import { CalendarClock, ExternalLink, MapPin } from "lucide-react";
import { dateRange } from "@/lib/tournaments";
import { type UpcomingEvent, venueHref } from "@/lib/venues";

/** "Coming up" cards. Renders nothing when there's nothing scheduled. */
export default function UpcomingList({
  items, seriesNames, title = "Coming up", compact = false,
}: {
  items: UpcomingEvent[];
  seriesNames?: Map<number, string>;
  title?: string;
  compact?: boolean;
}) {
  if (!items.length) return null;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <section aria-label={title}>
      <h2 className={`mb-4 flex items-center gap-2 font-display font-semibold tracking-tight ${compact ? "text-lg" : "text-2xl"}`}>
        <CalendarClock size={compact ? 18 : 22} className="text-primary" aria-hidden="true" /> {title}
      </h2>
      <ul className={compact ? "space-y-3" : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"}>
        {items.map((u) => {
          const live = u.start_date <= today && (u.end_date ?? u.start_date) >= today;
          const series = u.series_id ? seriesNames?.get(u.series_id) : null;
          return (
            <li key={u.id} className="panel flex h-full flex-col gap-2 p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="eyebrow truncate">{series ?? "Tournament"}</span>
                {live ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-success">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" aria-hidden="true" /> On now
                  </span>
                ) : (
                  <span className="shrink-0 font-mono text-xs text-base-content/50">{dateRange(u.start_date, u.end_date)}</span>
                )}
              </div>
              <h3 className="font-display text-lg font-semibold leading-snug">{u.title}</h3>
              {(u.casino || u.city) && (
                <p className="flex items-center gap-1.5 text-sm text-base-content/55">
                  <MapPin size={14} aria-hidden="true" />
                  {u.casino ? <Link href={venueHref(u.casino)} className="hover:text-primary">{u.casino}</Link> : null}
                  {u.casino && u.city && u.city !== u.casino ? ` · ${u.city}` : !u.casino ? u.city : ""}
                </p>
              )}
              {u.description && !compact && <p className="line-clamp-3 text-sm text-base-content/60">{u.description}</p>}
              {u.url && (
                <a href={u.url} target="_blank" rel="noopener noreferrer" className="mt-auto inline-flex items-center gap-1.5 pt-1 text-sm font-medium text-primary hover:underline">
                  Details <ExternalLink size={13} aria-hidden="true" />
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
