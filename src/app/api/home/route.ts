import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseServer";

export const revalidate = 60; 

export async function GET() {
  const supabase = await createSupabaseRouteClient();
  console.log("🏠 API: Fetching Home Data...");

  try {
    // 1. Get Active Season with ALL Leagues
    const { data: activeSeason, error: seasonError } = await supabase
      .from("seasons")
      .select(`id, label, start_date, end_date, leagues (id, slug, label)`)
      .eq("is_active", true)
      .maybeSingle();

    if (seasonError) console.error("❌ API Season Error:", seasonError);

    if (!activeSeason) {
      console.warn("⚠️ API: No active season found.");
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

    // 2. Fetch Leaderboards for ALL leagues using the NEW function
    const leaderboardPromises = activeSeason.leagues.map(async (league: any) => {
        console.log(`📊 API: Fetching leaderboard for ${league.slug} (ID: ${league.id})`);
        
        // ✅ CRITICAL FIX: Use the NEW function 'get_league_leaderboard'
        const { data: liveData, error: rpcError } = await supabase.rpc("get_league_leaderboard", { p_league_id: league.id });
        
        if (rpcError) {
            console.error(`❌ API RPC Error (${league.slug}):`, rpcError);
            return { slug: league.slug, label: league.label, data: [] };
        }

        const standings = liveData || [];

        // Snapshot History (Optimization: Only calc movement if we have data)
        let dataWithMovement = standings.map((row: any) => ({ ...row, movement: 0 }));

        if (standings.length > 0) {
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

    // ✅ FORCE COMPATIBILITY: Ensure 'npl' key exists for the Homepage
    if (!leaderboards['npl']) {
        leaderboards['npl'] = leaderboards['global'] || results[0]?.data || [];
    }
    if (!leaderboards['hrl']) {
        leaderboards['hrl'] = leaderboards['hr'] || [];
    }

    // 4. Widgets (Gainers/Trending)
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

    // 5. Upcoming & Latest Results
    const today = new Date().toISOString().slice(0, 10);
    const { data: upcoming } = await supabase
      .from("events")
      .select("id,name,start_date,festival_id,series_id")
      .eq("is_deleted", false)
      .gte("start_date", today)
      .order("start_date", { ascending: true })
      .limit(12);

    const { data: latestResultsRaw } = await supabase
        .from("results")
        .select("id, player_id, tournament_name, prize_amount, position_of_prize, created_at, event_id")
        .eq("is_deleted", false)
        .eq("position_of_prize", 1)
        .order("created_at", { ascending: false })
        .limit(10);
    
    // Enrich latest results with winner names
    let latestResults: any[] = [];
    if(latestResultsRaw && latestResultsRaw.length > 0) {
        const pids = latestResultsRaw.map((r:any) => r.player_id);
        const { data: players } = await supabase.from('players').select('id, display_name').in('id', pids);
        latestResults = latestResultsRaw.map((r:any) => ({
            ...r,
            winner_name: players?.find((p:any) => p.id === r.player_id)?.display_name || "Unknown",
            result_date: r.created_at.slice(0, 10)
        }));
    }

    console.log("✅ API: Home Data Loaded Successfully");
    return NextResponse.json({
      ok: true,
      season_meta: {
        id: activeSeason.id,
        label: activeSeason.label,
        start_date: activeSeason.start_date,
        end_date: activeSeason.end_date,
      },
      leagues: leagueMeta,
      leaderboards, 
      upcoming_events: upcoming || [],
      trending_players: trending,
      biggest_gainers: biggestGainers,
      latest_results: latestResults
    });

  } catch (e: any) {
    console.error("❌ API CRITICAL ERROR:", e);
    return NextResponse.json({ ok: false, error: e.message });
  }
}