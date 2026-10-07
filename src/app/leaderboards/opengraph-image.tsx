import { createSupabasePublicClient } from "@/lib/supabasePublic";
import { ogCard, OG_SIZE } from "@/lib/og";

export const size = OG_SIZE;
export const alt = "NPL leaderboard";
export const contentType = "image/png";
export const revalidate = 3600;

export default async function Image() {
  const supabase = createSupabasePublicClient();
  const { data: season } = await supabase.from("seasons").select("id, name").eq("is_active", true).maybeSingle();
  const { data: league } = await supabase
    .from("leagues")
    .select("id")
    .eq("season_id", season?.id ?? -1)
    .eq("slug", "npl")
    .maybeSingle();
  const { data: top } = league
    ? await supabase.rpc("league_standings", { p_league_id: league.id }).order("position").limit(5)
    : { data: [] };

  return ogCard({
    eyebrow: `${season?.name ?? "Season"} · NPL leaderboard`,
    title: "Who's leading the season",
    rows: (top || []).map((r) => ({ rank: `#${r.position}`, name: r.display_name, value: `${Number(r.total_points).toFixed(2)} pts` })),
  });
}
