import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseServer";

export const revalidate = 60; 

export async function GET() {
  const supabase = await createSupabaseRouteClient();

  try {
    // 1. Get Active Season & League Config
    const { data: activeSeason } = await supabase
      .from("seasons")
      .select(`id, label, start_date, end_date, leagues (id, slug, label)`)
      .eq("is_active", true)
      .single();

    if (!activeSeason) {
      return NextResponse.json({ ok: false, error: "No active season" }, { status: 404 });
    }

    const nplLeague = activeSeason.leagues.find((l: any) => l.slug === 'global') || activeSeason.leagues[0];
    const hrLeague = activeSeason.leagues.find((l: any) => l.slug.includes('hr'));

    // 2. Fetch LIVE Leaderboards
    const [nplData, hrData] = await Promise.all([
      nplLeague ? supabase.rpc("get_league_leaderboard", { p_league_id: nplLeague.id }) : { data: [] },
      hrLeague ? supabase.rpc("get_league_leaderboard", { p_league_id: hrLeague.id }) : { data: [] }
    ]);

    const liveStandings = nplData.data || [];

    // 3. Fetch HISTORY (Latest Snapshot)
    // We get the most recent snapshot_date for this league
    const { data: latestSnapshotDate } = await supabase
      .from("leaderboard_positions")
      .select("snapshot_date")
      .eq("league", nplLeague.slug)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .single();

    let pastStandings: Record<string, number> = {};

    if (latestSnapshotDate) {
      // Fetch positions from that specific date
      const { data: history } = await supabase
        .from("leaderboard_positions")
        .select("player_id, position")
        .eq("league", nplLeague.slug)
        .eq("snapshot_date", latestSnapshotDate.snapshot_date);
      
      // Convert to a Map for fast lookup: { "player_123": 5, "player_456": 10 }
      history?.forEach((h: any) => {
        if (h.player_id) pastStandings[h.player_id] = h.position;
      });
    }

    // 4. Calculate Movement
    const nplWithMovement = liveStandings.map((row: any) => {
      const currentPos = row.position;
      const pastPos = pastStandings[row.player_id];
      
      // Calculate Delta (Positive means they moved UP the ranking, e.g. 10 -> 5 is +5)
      // If no past history, movement is 0 (new entry)
      const movement = pastPos ? (pastPos - currentPos) : 0;

      return {
        ...row,
        movement
      };
    });

    // 5. Identify Biggest Gainers (Sort by movement desc)
    const biggestGainers = [...nplWithMovement]
      .filter(p => p.movement > 0) // Only show people who moved up
      .sort((a, b) => b.movement - a.movement)
      .slice(0, 5)
      .map(p => ({
        player_id: p.player_id,
        display_name: p.display_name,
        from_pos: p.position + p.movement,
        to_pos: p.position,
        delta: p.movement
      }));

    // 6. Identify Trending (Top viewed or just Top Movers for now)
    // We'll use biggest gainers + top players mixed
    const trending = nplWithMovement
      .sort((a, b) => b.movement - a.movement) // Sort by buzz/movement
      .slice(0, 5)
      .map((p: any) => ({
        player_id: p.player_id,
        display_name: p.display_name,
        hits: 100 + (p.movement * 10) // Fake "hits" score based on movement
      }));

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
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}