import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseServer";

export const revalidate = 60; 

export async function GET() {
  const supabase = await createSupabaseRouteClient();

  try {
    // 1. Active Season
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
        leaderboards: { npl: [], hrl: [] }, // Return empty structure expected by frontend
        upcoming_events: [],
        trending_players: [],
        biggest_gainers: []
      });
    }

    // 2. Fetch Leaderboards
    const leaderboardPromises = activeSeason.leagues.map(async (league: any) => {
        const { data: liveData } = await supabase.rpc("get_league_leaderboard", { p_league_id: league.id });
        const standings = liveData || [];

        // Snapshot History (Optimization: Only fetch for main league to save DB calls)
        let dataWithMovement = standings.map((row: any) => ({ ...row, movement: 0 }));

        if (league.slug === 'global' || league.slug === 'npl') {
             const { data: latestSnapshot } = await supabase
                .from("leaderboard_positions")
                .select("snapshot_date")
                .eq("league", league.slug)
                .order("snapshot_date", { ascending: false }) 
                .limit(1)
                .maybeSingle();

            if (latestSnapshot) {
                const { data: history } = await supabase
                    .from("leaderboard_positions")
                    .select("player_id, position")
                    .eq("league", league.slug)
                    .eq("snapshot_date", latestSnapshot.snapshot_date);
                
                const pastStandings: Record<string, number> = {};
                history?.forEach((h: any) => pastStandings[h.player_id] = h.position);

                dataWithMovement = standings.map((row: any) => ({
                    ...row, 
                    movement: pastStandings[row.player_id] ? (pastStandings[row.player_id] - row.position) : 0
                }));
            }
        }

        return { slug: league.slug, label: league.label, data: dataWithMovement };
    });

    const results = await Promise.all(leaderboardPromises);

    // 3. Map Results
    const leaderboards: Record<string, any[]> = {};
    const leagueMeta: { slug: string, label: string }[] = [];

    results.forEach((r) => {
        leaderboards[r.slug] = r.data;
        leagueMeta.push({ slug: r.slug, label: r.label });
    });

    // ✅ FORCE MAPPING: Ensure 'npl' key exists for the Homepage
    if (!leaderboards['npl']) {
        // Use 'global' if exists, otherwise the first league found
        leaderboards['npl'] = leaderboards['global'] || results[0]?.data || [];
    }
    // Ensure 'hrl' key exists
    if (!leaderboards['hrl']) {
        leaderboards['hrl'] = leaderboards['hr'] || [];
    }

    // 4. Widgets
    const mainData = leaderboards['npl'];
    const biggestGainers = [...mainData]
        .filter((p: any) => p.movement > 0)
        .sort((a: any, b: any) => b.movement - a.movement)
        .slice(0, 5)
        .map((p: any) => ({
            player_id: p.player_id,
            display_name: p.display_name,
            from_pos: p.position + p.movement,
            to_pos: p.position,
            delta: p.movement
        }));

    const trending = [...mainData]
        .sort((a: any, b: any) => b.movement - a.movement)
        .slice(0, 5)
        .map((p: any) => ({
            player_id: p.player_id,
            display_name: p.display_name,
            hits: 100 + (p.movement * 10)
        }));

    return NextResponse.json({
      ok: true,
      season_meta: {
        id: activeSeason.id,
        label: activeSeason.label,
        start_date: activeSeason.start_date,
        end_date: activeSeason.end_date,
      },
      leagues: leagueMeta,
      leaderboards, // Now contains 'npl' key guaranteed
      upcoming_events: [],
      trending_players: trending,
      biggest_gainers: biggestGainers
    });

  } catch (e: any) {
    console.error("Home API Error:", e);
    return NextResponse.json({ ok: false, error: e.message });
  }
}