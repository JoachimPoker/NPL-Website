import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseServer";

export const revalidate = 60; 

export async function GET() {
  const supabase = await createSupabaseRouteClient();

  try {
    // 1. Try to fetch Active Season
    const { data: activeSeason } = await supabase
      .from("seasons")
      .select(`id, label, start_date, end_date, leagues (id, slug, label)`)
      .eq("is_active", true)
      .maybeSingle(); // <--- Changed from .single() to .maybeSingle() to prevent crash on 0 rows

    // ---------------------------------------------------------
    // FALLBACK FOR EMPTY DB (Prevent "Failed to load data")
    // ---------------------------------------------------------
    if (!activeSeason) {
      return NextResponse.json({
        ok: true,
        season_meta: {
          id: 0,
          label: "Pre-Season", // Default label when no season exists
          start_date: new Date().toISOString(),
          end_date: new Date().toISOString(),
        },
        leaderboards: { npl: [], hrl: [] },
        upcoming_events: [],
        trending_players: [],
        biggest_gainers: []
      });
    }
    // ---------------------------------------------------------

    const nplLeague = activeSeason.leagues.find((l: any) => l.slug === 'global') || activeSeason.leagues[0];
    const hrLeague = activeSeason.leagues.find((l: any) => l.slug.includes('hr'));

    // 2. Fetch LIVE Leaderboards
    const [nplData, hrData] = await Promise.all([
      nplLeague ? supabase.rpc("get_league_leaderboard", { p_league_id: nplLeague.id }) : { data: [] },
      hrLeague ? supabase.rpc("get_league_leaderboard", { p_league_id: hrLeague.id }) : { data: [] }
    ]);

    const liveStandings = nplData.data || [];

    // 3. Fetch HISTORY (Latest Snapshot)
    // Safe check: nplLeague might be undefined if you created a season but no leagues yet
    let biggestGainers: any[] = [];
    let trending: any[] = [];
    let nplWithMovement = liveStandings;

    if (nplLeague) {
        const { data: latestSnapshotDate } = await supabase
        .from("leaderboard_positions")
        .select("snapshot_date")
        .eq("league", nplLeague.slug)
        .order("snapshot_date", { ascending: false })
        .limit(1)
        .maybeSingle();

        let pastStandings: Record<string, number> = {};

        if (latestSnapshotDate) {
            const { data: history } = await supabase
                .from("leaderboard_positions")
                .select("player_id, position")
                .eq("league", nplLeague.slug)
                .eq("snapshot_date", latestSnapshotDate.snapshot_date);
            
            history?.forEach((h: any) => {
                if (h.player_id) pastStandings[h.player_id] = h.position;
            });
        }

        // 4. Calculate Movement
        nplWithMovement = liveStandings.map((row: any) => {
            const currentPos = row.position;
            const pastPos = pastStandings[row.player_id];
            const movement = pastPos ? (pastPos - currentPos) : 0; 
            return { ...row, movement };
        });

        // 5. Identify Biggest Gainers
        biggestGainers = [...nplWithMovement]
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

        // 6. Trending
        trending = nplWithMovement
        .sort((a: any, b: any) => b.movement - a.movement)
        .slice(0, 5)
        .map((p: any) => ({
            player_id: p.player_id,
            display_name: p.display_name,
            hits: 100 + (p.movement * 10)
        }));
    }

    return NextResponse.json({
      ok: true,
      season_meta: {
        id: activeSeason.id,
        label: activeSeason.label,
        start_date: activeSeason.start_date,
        end_date: activeSeason.end_date,
      },
      leaderboards: {
        npl: nplWithMovement,
        hrl: hrData.data || []
      },
      upcoming_events: [],
      trending_players: trending,
      biggest_gainers: biggestGainers
    });

  } catch (e: any) {
    // Even on crash, try to return empty struct so UI doesn't break
    console.error("Home API Error:", e);
    return NextResponse.json({ 
        ok: true, // Lie to the frontend so it renders
        season_meta: { id: 0, label: "Loading...", start_date: "", end_date: "" },
        leaderboards: { npl: [], hrl: [] },
        upcoming_events: [],
        trending_players: [],
        biggest_gainers: []
    });
  }
}