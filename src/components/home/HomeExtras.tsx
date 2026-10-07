import { createSupabasePublicClient } from "@/lib/supabasePublic";
import { type EventSummary, type FestivalSummary, type SeriesRow } from "@/lib/tournaments";
import { getUpcoming } from "@/lib/venues";

/** Everything the home page's lower sections need (This season, Latest results, News), in parallel. */
export async function getHomeExtras() {
  const supabase = createSupabasePublicClient();
  const upcomingPromise = getUpcoming({ limit: 3 });
  const { data: season } = await supabase.from("seasons").select("id, name").eq("is_active", true).maybeSingle();
  const sid = season?.id ?? -1;

  const [{ data: events }, { data: festivals }, { data: series }, { data: news }] = await Promise.all([
    supabase.from("event_summary").select("*").eq("season_id", sid).order("start_date", { ascending: false }),
    supabase.from("festival_summary").select("*").eq("season_id", sid).order("start_date", { ascending: false }).limit(2),
    supabase.from("series").select("*"),
    supabase
      .from("news")
      .select("id, title, category, excerpt, published_at")
      .eq("is_published", true)
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false })
      .limit(3),
  ]);

  const ev = (events || []) as EventSummary[];
  const seriesById = new Map(((series || []) as SeriesRow[]).map((s) => [s.id, s]));

  return {
    seasonName: season?.name ?? null,
    upcoming: await upcomingPromise,
    seriesNames: new Map([...seriesById.values()].map((s) => [s.id, s.name])),
    stats: {
      events: ev.length,
      cashes: ev.reduce((n, e) => n + e.entries, 0),
      paid: ev.reduce((n, e) => n + Number(e.paid_out || 0), 0),
      festivals: new Set(ev.map((e) => e.festival_id).filter(Boolean)).size,
      updatedTo: ev[0]?.start_date ?? null,
    },
    latest: ev.slice(0, 3).map((e) => ({ event: e, series: e.series_id ? seriesById.get(e.series_id) ?? null : null })),
    festivals: ((festivals || []) as FestivalSummary[])
      .map((f) => ({ festival: f, series: f.series_id ? seriesById.get(f.series_id) : undefined }))
      .filter((x): x is { festival: FestivalSummary; series: SeriesRow } => !!x.series),
    news: news || [],
  };
}
