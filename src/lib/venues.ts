import { createSupabaseServerClient } from "@/lib/supabaseServer";
import type { Database } from "@/types/supabase";

export type VenueSummary = Database["public"]["Views"]["venue_summary"]["Row"];
export type UpcomingEvent = Database["public"]["Tables"]["upcoming_events"]["Row"];

/** "Edinburgh Maybury" -> "edinburgh-maybury" */
export const venueSlug = (casino: string) =>
  casino.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const venueHref = (casino: string) => `/venues/${venueSlug(casino)}`;

export async function getVenues() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("venue_summary").select("*").order("events", { ascending: false });
  return (data || []) as VenueSummary[];
}

/** Upcoming (or still running) events, soonest first. */
export async function getUpcoming(opts: { seriesId?: number; casino?: string; limit?: number } = {}) {
  const supabase = await createSupabaseServerClient();
  const today = new Date().toISOString().slice(0, 10);
  let q = supabase
    .from("upcoming_events")
    .select("*")
    .eq("is_published", true)
    .or(`end_date.gte.${today},and(end_date.is.null,start_date.gte.${today})`)
    .order("start_date")
    .limit(opts.limit ?? 6);
  if (opts.seriesId) q = q.eq("series_id", opts.seriesId);
  if (opts.casino) q = q.eq("casino", opts.casino);
  const { data } = await q;
  return (data || []) as UpcomingEvent[];
}
