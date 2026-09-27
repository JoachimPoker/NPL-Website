import type { Database } from "@/types/supabase";

export type EventSummary = Database["public"]["Views"]["event_summary"]["Row"];
export type FestivalSummary = Database["public"]["Views"]["festival_summary"]["Row"];
export type SeriesRow = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  has_festivals: boolean;
  sort_order: number;
};

export const gbp = (n: number | null | undefined) =>
  n == null ? "–" : n.toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });

/** Headline money figures. The brand book asks for full figures with commas, never "K" or "M". */
export const gbpShort = (n: number | null | undefined) => gbp(n == null ? n : Number(n));

export const day = (d: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) =>
  d ? new Date(d).toLocaleDateString("en-GB", opts) : "–";

export function dateRange(start: string | null, end: string | null) {
  if (!start) return "–";
  const s = new Date(start), e = new Date(end ?? start);
  if (s.toDateString() === e.toDateString()) return day(start, { day: "numeric", month: "short", year: "numeric" });
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  return sameMonth
    ? `${s.getDate()}–${day(end, { day: "numeric", month: "short", year: "numeric" })}`
    : `${day(start)} – ${day(end, { day: "numeric", month: "short", year: "numeric" })}`;
}

export const eventHref = (id: number | string) => `/events/e/${id}`;
export const seriesHref = (s: Pick<SeriesRow, "slug">) => `/events/${s.slug}`;
export const festivalHref = (s: Pick<SeriesRow, "slug">, festivalId: string) => `/events/${s.slug}/${festivalId}`;

/** Tournament names repeat the festival ("GUKPT Luton - Event 7 - Main Event - £150,000 GTD"):
 *  show just the event part when it's already clear from context. */
export function shortEventName(name: string | null) {
  if (!name) return "Event";
  const parts = name.split(/\s+[-–]\s+/);
  const body = parts.filter((p) => !/^event\s*\d+$/i.test(p) && !/^#\d+$/.test(p));
  return (body.length > 1 ? body.slice(1) : body).join(" – ") || name;
}
