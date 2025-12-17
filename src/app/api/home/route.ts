import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseServer";

export const revalidate = 60; 

export async function GET() {
  const supabase = await createSupabaseRouteClient();

  try {
    // 1. Get Active Season
    const { data: activeSeason } = await supabase
      .from("seasons")
      .select(`id, label, start_date, end_date, leagues (id, slug, label)`)
      .eq("is_active", true)
      .maybeSingle();

    if (!activeSeason) {
      return NextResponse.json({
        ok: true,
        season_meta: { id: 0, label: "Pre-Season", start_date: "", end_date: "" },
        leagues: [],
        leaderboards: { npl: [], hrl: [] },
        upcoming_events: [],
        trending_players: [],
        biggest_gainers: []
      });
    }

    // 2. Fetch Leaderboards
    const leaderboardPromises = activeSeason.leagues.map(async (league: any) => {
        // ✅ Uses the NEW function
        const { data: liveData } = await supabase.rpc("get_league_leaderboard", { p_league_id: league.id });
        const standings = liveData || [];

        // Add dummy movement (or calculate if snapshot exists)
        const dataWithMovement = standings.map((row: any) => ({ ...row, movement: 0 }));

        return { slug: league.slug, label: league.label, data: dataWithMovement };
    });

    const results = await Promise.all(leaderboardPromises);

    // 3. Map to Frontend Structure
    const leaderboards: Record<string, any[]> = {};
    const leagueMeta: { slug: string, label: string }[] = [];

    results.forEach((r) => {
        leaderboards[r.slug] = r.data;
        leagueMeta.push({ slug: r.slug, label: r.label });
    });

    // Fallbacks for Home Component
    if (!leaderboards['npl']) leaderboards['npl'] = leaderboards['global'] || results[0]?.data || [];
    if (!leaderboards['hrl']) leaderboards['hrl'] = leaderboards['hr'] || [];

    // 4. Widgets
    const mainData = leaderboards['npl'];
    const gainers = mainData.slice(0, 5).map((p: any) => ({
       player_id: p.player_id, display_name: p.display_name, from_pos: p.position, to_pos: p.position, delta: 0
    }));
    const trending = mainData.slice(0, 5).map((p: any) => ({
       player_id: p.player_id, display_name: p.display_name, hits: 100
    }));

    // 5. Events & Results
    const today = new Date().toISOString().slice(0, 10);
    const { data: upcoming } = await supabase.from("events").select("id,name,start_date").eq("is_deleted", false).gte("start_date", today).limit(5);
    const { data: latest } = await supabase.from("results").select("id,tournament_name,prize_amount,created_at").eq("position_of_prize", 1).order("created_at", { ascending: false }).limit(5);

    return NextResponse.json({
      ok: true,
      season_meta: { id: activeSeason.id, label: activeSeason.label, start_date: activeSeason.start_date, end_date: activeSeason.end_date },
      leagues: leagueMeta,
      leaderboards,
      upcoming_events: upcoming || [],
      trending_players: trending,
      biggest_gainers: gainers,
      latest_results: latest?.map((r: any) => ({ ...r, winner_name: "Winner", result_date: r.created_at })) || []
    });

  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message });
  }
}