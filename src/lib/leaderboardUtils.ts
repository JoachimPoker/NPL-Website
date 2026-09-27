import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Snapshots every league of the active season (used for movement arrows and rank history).
 * Needs the service-role client: take_season_snapshot is not callable by signed-in users.
 * @param dateOverride Optional YYYY-MM-DD date for the snapshot (defaults to today).
 */
export async function takeLeaderboardSnapshot(supabase: SupabaseClient, dateOverride?: string) {
  const { data: season, error } = await supabase
    .from("seasons")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  if (!season) throw new Error("No active season.");

  const snapshotDate = dateOverride || new Date().toISOString().split("T")[0];
  const { data: positions, error: rpcErr } = await supabase.rpc("take_season_snapshot", {
    p_season_id: season.id,
    p_date: snapshotDate,
  });
  if (rpcErr) throw rpcErr;
  return { snapshotDate, positions: positions as number };
}
