import Link from "next/link";
import { Trophy, CalendarDays } from "lucide-react";
import {
  type EventSummary, type FestivalSummary, type SeriesRow,
  gbpShort, day, dateRange, eventHref, festivalHref, seriesHref,
} from "@/lib/tournaments";

/** Series logos are wide banners, so they keep their shape: a fixed height, width follows. */
const LOGO_HEIGHT = { xs: "h-5 max-w-28", sm: "h-8 max-w-44", md: "h-11 max-w-56", lg: "h-20 max-w-[26rem]" } as const;

export function SeriesLogo({ series, size = "md", className = "" }: {
  series: Pick<SeriesRow, "name" | "logo_url">;
  size?: keyof typeof LOGO_HEIGHT;
  className?: string;
}) {
  if (!series.logo_url) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={series.logo_url} alt={series.name} className={`${LOGO_HEIGHT[size]} w-auto shrink-0 rounded-[4px] object-contain object-left ${className}`} />;
}

/** The series logo, or its name set as a banner of the same height when there's no logo yet. */
export function SeriesBanner({ series, size = "md", className = "" }: {
  series: Pick<SeriesRow, "name" | "logo_url">;
  size?: "sm" | "md";
  className?: string;
}) {
  if (series.logo_url) return <SeriesLogo series={series} size={size} className={className} />;
  return (
    <span
      className={`inline-flex w-fit shrink-0 items-center rounded-[4px] bg-primary/12 font-display font-bold uppercase tracking-wide text-primary ring-1 ring-inset ring-primary/25 ${
        size === "sm" ? "h-8 px-2.5 text-sm" : "h-11 px-3.5 text-base"
      } ${className}`}
    >
      {series.name}
    </span>
  );
}

/** Series logo, or its initials on a felt tile. */
export function SeriesMark({ series, size = "md" }: { series?: Pick<SeriesRow, "name" | "logo_url"> | null; size?: "sm" | "md" | "lg" }) {
  const dim = size === "lg" ? "h-14 w-14 text-lg" : size === "sm" ? "h-7 w-7 text-[10px]" : "h-10 w-10 text-xs";
  if (series?.logo_url) return <SeriesLogo series={series} size={size} />;
  const initials = (series?.name ?? "?").replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).map((w) => w[0]).join("").slice(0, 3) || "?";
  return (
    <span
      className={`${dim} flex shrink-0 items-center justify-center rounded-[10px] bg-primary/12 font-display font-bold tracking-tight text-primary ring-1 ring-inset ring-primary/20`}
      aria-hidden="true"
    >
      {initials.toUpperCase()}
    </span>
  );
}

/** One tournament with its winner, for "latest results" lists. */
export function ResultCard({ event, series, compactName = false }: {
  event: EventSummary;
  series?: SeriesRow | null;
  compactName?: boolean;
}) {
  return (
    <Link href={eventHref(event.id)} className="panel group flex h-full flex-col gap-4 p-5 transition-colors hover:border-primary/40">
      <div className="flex items-center justify-between gap-3">
        {series?.logo_url ? (
          <span className="flex min-w-0 items-center gap-2">
            <SeriesLogo series={series} size="xs" />
            <span className="eyebrow truncate">{event.casino}</span>
          </span>
        ) : (
          <span className="eyebrow truncate">{series?.name ?? "Tournament"} · {event.casino}</span>
        )}
        <time className="shrink-0 font-mono text-xs text-base-content/45">{day(event.start_date)}</time>
      </div>
      <h3 className="line-clamp-2 font-display text-lg font-semibold leading-snug transition-colors group-hover:text-primary">
        {compactName ? event.name?.replace(/\s+[-–]\s+£[\d,]+.*$/, "") : event.name}
      </h3>
      <div className="mt-auto flex items-end justify-between gap-4 border-t border-base-content/[0.07] pt-4">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-base-content/45">
            <Trophy size={12} className="text-primary" aria-hidden="true" /> Winner
          </div>
          <div className="truncate font-medium">{event.winner_name ?? "–"}</div>
        </div>
        <div className="shrink-0 text-right font-mono text-xs text-base-content/55">
          <div>{event.entries.toLocaleString("en-GB")} cashes</div>
          <div>{gbpShort(event.paid_out)} paid</div>
        </div>
      </div>
    </Link>
  );
}

/** A festival with its headline numbers and Main Event winner. */
export function FestivalCard({ festival, series }: { festival: FestivalSummary; series: SeriesRow }) {
  return (
    <Link
      href={festivalHref(series, festival.id)}
      data-series={series.slug}
      className="festival-card panel group relative flex h-full flex-col gap-5 overflow-hidden p-6 transition-colors hover:border-primary/40"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0">
          <SeriesBanner series={series} size="sm" className="festival-logo mb-2.5" />
          <h3 className="font-display text-xl font-semibold leading-tight tracking-tight transition-colors group-hover:text-primary">
            {festival.label.replace(/\s·\s\w{3}\s\d{4}$/, "")}
          </h3>
          <div className="festival-dates mt-1 flex items-center gap-1.5 text-sm text-base-content/55">
            <CalendarDays size={14} aria-hidden="true" /> {dateRange(festival.start_date, festival.end_date)}
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-3 text-center">
        <Stat label="Events" value={String(festival.events)} />
        <Stat label="Cashes" value={festival.entries.toLocaleString("en-GB")} />
        <Stat label="Paid out" value={gbpShort(festival.paid_out)} />
      </dl>

      {festival.main_event_winner && (
        <div className="festival-main mt-auto flex items-center gap-2 rounded-lg bg-primary/[0.06] px-3 py-2 text-sm ring-1 ring-inset ring-primary/15">
          <Trophy size={15} className="shrink-0 text-primary" aria-hidden="true" />
          <span className="text-base-content/55">Main Event:</span>
          <span className="truncate font-medium">{festival.main_event_winner}</span>
        </div>
      )}
    </Link>
  );
}

/** A series tile for the Tournaments hub. */
export function SeriesTile({ series, events, festivals, lastDate }: {
  series: SeriesRow;
  events: number;
  festivals: number;
  lastDate: string | null;
}) {
  return (
    <Link href={seriesHref(series)} className="panel group flex flex-col gap-3 p-4 transition-colors hover:border-primary/40">
      <SeriesBanner series={series} />
      <div className="min-w-0 flex-1">
        <div className="sr-only">{series.name}</div>
        <div className="text-xs text-base-content/50">
          {events ? (
            <>
              {events} event{events === 1 ? "" : "s"}
              {series.has_festivals && festivals > 0 && ` · ${festivals} festival${festivals === 1 ? "" : "s"}`}
              {lastDate && ` · last ${day(lastDate)}`}
            </>
          ) : (
            "No events this season"
          )}
        </div>
      </div>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-base-200/60 px-2 py-2">
      <dt className="text-[10px] uppercase tracking-wider text-base-content/45">{label}</dt>
      <dd className="font-mono text-sm font-semibold">{value}</dd>
    </div>
  );
}
