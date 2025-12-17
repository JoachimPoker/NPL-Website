import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Takes a snapshot of the current active Global Leaderboard.
 * Call this immediately after importing new results.
 */
export async function takeLeaderboardSnapshot(supabase: SupabaseClient) {
  try {
    console.log("📸 Starting Leaderboard Snapshot...");

    // 1. Get Active Season & Global League
    const { data: activeSeason } = await supabase
      .from("seasons")
      .select(`leagues (id, slug)`)
      .eq("is_active", true)
      .single();

    if (!activeSeason || !activeSeason.leagues?.length) {
      console.log("⚠️ Snapshot skipped: No active season/leagues found.");
      return;
    }

    // Find Global League (fallback to first if 'global' not found)
    const globalLeague = activeSeason.leagues.find((l: any) => l.slug === 'global') || activeSeason.leagues[0];

    // 2. Calculate Current Standings using the DB function
    const { data: liveData, error } = await supabase.rpc("get_league_leaderboard", { 
      p_league_id: globalLeague.id 
    });

    if (error) {
      console.error("❌ Snapshot Error fetching live data:", error);
      return;
    }
    
    if (!liveData || liveData.length === 0) {
      console.log("⚠️ Snapshot skipped: No live results found.");
      return;
    }

    // 3. Prepare Snapshot Rows
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Clean up any existing snapshot for TODAY (allows re-running imports)
    await supabase.from("leaderboard_positions")
      .delete()
      .eq("league", globalLeague.slug)
      .eq("snapshot_date", today);

    // 4. Save to History
    // We filter out null player_ids (anonymous players aren't tracked for history)
    const rows = liveData.map((p: any) => ({
      player_id: p.player_id, 
      league: globalLeague.slug,
      position: p.position,
      points: p.total_points,
      snapshot_date: today
    })).filter((r: any) => r.player_id !== null);

    if (rows.length > 0) {
      const { error: insertError } = await supabase.from("leaderboard_positions").insert(rows);
      if (insertError) console.error("❌ Snapshot Insert Error:", insertError);
      else console.log(`✅ Snapshot saved: ${rows.length} players tracked.`);
    }

  } catch (e) {
    console.error("❌ Snapshot failed:", e);
  }
}