import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Takes a snapshot of ALL active leaderboards.
 * @param dateOverride Optional YYYY-MM-DD date to force this snapshot to a specific point in time.
 */
export async function takeLeaderboardSnapshot(supabase: SupabaseClient, dateOverride?: string) {
  try {
    console.log(`📸 Starting Leaderboard Snapshot... (Date: ${dateOverride || "Today"})`);

    // 1. Get Active Season & ALL Leagues
    const { data: activeSeason } = await supabase
      .from("seasons")
      .select(`leagues (id, slug)`)
      .eq("is_active", true)
      .single();

    if (!activeSeason || !activeSeason.leagues?.length) {
      console.log("⚠️ Snapshot skipped: No active season/leagues found.");
      return;
    }

    // Use override date if provided, otherwise today's date
    const snapshotDate = dateOverride || new Date().toISOString().split('T')[0];
    let totalSaved = 0;

    // 2. Loop through EVERY league (Global, HR, Low, etc.)
    for (const league of activeSeason.leagues) {
        // A. Calculate Current Standings
        const { data: liveData, error } = await supabase.rpc("get_league_leaderboard", { 
            p_league_id: league.id 
        });

        if (error) {
            console.error(`❌ Error fetching data for league ${league.slug}:`, error);
            continue;
        }
        
        if (!liveData || liveData.length === 0) continue;

        // B. Clean up existing snapshot for THIS DATE (allows re-running imports without duplicates)
        await supabase.from("leaderboard_positions")
            .delete()
            .eq("league", league.slug)
            .eq("snapshot_date", snapshotDate);

        // C. Prepare Rows
        const rows = liveData.map((p: any) => ({
            player_id: p.player_id, 
            league: league.slug,
            position: p.position,
            points: p.total_points,
            snapshot_date: snapshotDate // <--- Uses the custom date
        })).filter((r: any) => r.player_id !== null);

        // D. Save to DB
        if (rows.length > 0) {
            const { error: insertError } = await supabase.from("leaderboard_positions").insert(rows);
            if (insertError) console.error(`❌ Insert Error (${league.slug}):`, insertError);
            else totalSaved += rows.length;
        }
    }

    console.log(`✅ Snapshot complete for ${snapshotDate}. Tracked ${totalSaved} positions.`);

  } catch (e) {
    console.error("❌ Snapshot failed:", e);
  }
}