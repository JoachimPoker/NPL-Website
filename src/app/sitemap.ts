import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { SITE_URL } from "@/lib/site";
import { venueSlug } from "@/lib/venues";

export const revalidate = 86400;

// Public (anon) client: the sitemap only lists what any visitor can see.
const supabase = () =>
  createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });

/** Reads every row in pages of 1,000 (the API's per-request cap). */
async function all<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null }>) {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await page(from, from + 999);
    out.push(...(data || []));
    if (!data || data.length < 1000) return out;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = supabase();
  const [series, festivals, events, players, news, { data: venues }] = await Promise.all([
    all((a, b) => db.from("series").select("id, slug").eq("is_active", true).range(a, b)),
    all((a, b) => db.from("festival_summary").select("id, end_date, series_id").range(a, b)),
    all((a, b) => db.from("event_summary").select("id, start_date").order("id").range(a, b)),
    // Only players who gave GDPR consent: the rest are shown by initials and marked noindex.
    all((a, b) => db.from("players").select("id").eq("gdpr", true).order("id").range(a, b)),
    all((a, b) => db.from("news").select("id, published_at").eq("is_published", true).range(a, b)),
    db.from("venue_summary").select("casino, last_event"),
  ]);
  const slugById = new Map(series.map((s) => [s.id, s.slug]));

  const url = (path: string, lastModified?: string | null, priority?: number): MetadataRoute.Sitemap[number] => ({
    url: `${SITE_URL}${path}`,
    ...(lastModified ? { lastModified } : {}),
    ...(priority ? { priority } : {}),
  });

  return [
    url("/", null, 1),
    url("/leaderboards", null, 0.9),
    url("/events", null, 0.8),
    url("/players", null, 0.8),
    url("/venues", null, 0.6),
    url("/hall-of-fame", null, 0.6),
    url("/about", null, 0.5),
    url("/contact", null, 0.3),
    url("/privacy", null, 0.2),
    url("/terms", null, 0.2),
    url("/safer-gambling", null, 0.3),
    url("/accessibility", null, 0.2),
    url("/badges", null, 0.5),
    url("/news", null, 0.5),
    url("/compare", null, 0.3),
    ...series.map((s) => url(`/events/${s.slug}`, null, 0.7)),
    ...festivals
      .filter((f) => f.series_id && slugById.get(f.series_id))
      .map((f) => url(`/events/${slugById.get(f.series_id!)}/${f.id}`, f.end_date, 0.6)),
    ...(venues || []).map((v) => url(`/venues/${venueSlug(v.casino)}`, v.last_event, 0.5)),
    ...news.map((n) => url(`/news/${n.id}`, n.published_at, 0.5)),
    ...events.map((e) => url(`/events/e/${e.id}`, e.start_date, 0.4)),
    ...players.map((p) => url(`/players/${p.id}`, null, 0.4)),
  ];
}
