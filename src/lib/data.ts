import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { displayName } from "@/lib/nameMask";

export async function getPlayerProfile(playerId: string) {
  const supabase = await createSupabaseServerClient();

  // 1. Fetch Player Basic Info
  const { data: player } = await supabase
    .from("players")
    .select("id, forename, surname, display_name, avatar_url")
    .eq("id", playerId)
    .single();

  if (!player) return null;

  // 2. Fetch Consent
  const { data: consentRows } = await supabase
    .from("results")
    .select("gdpr_flag")
    .eq("player_id", playerId);
  
  const consent = (consentRows || []).some((r: any) => !!r.gdpr_flag);

  // 3. Fetch Recent Results (Expanded to 50 for fuller history)
  const { data: results } = await supabase
    .from("results")
    .select(`id, points, prize_amount, position_of_prize, created_at,
             events:event_id ( id, name, start_date, site_name, buy_in_raw )`)
    .eq("player_id", playerId)
    .order("created_at", { ascending: false })
    .limit(50);

  // 4. Calculate Lifetime Stats
  const { data: allResults } = await supabase
    .from("results")
    .select("points, prize_amount, position_of_prize")
    .eq("player_id", playerId);
    
  const lifetime_points = (allResults || []).reduce((acc: number, row: any) => acc + (Number(row.points) || 0), 0);
  const total_earnings = (allResults || []).reduce((acc: number, row: any) => acc + (Number(row.prize_amount) || 0), 0);
  const total_wins = (allResults || []).filter((r: any) => r.position_of_prize === 1).length;

  // 5. Fetch Rank & Graph History (From Leaderboard Snapshots)
  // We look for their history in the 'global' league or 'npl'
  const { data: history } = await supabase
    .from("leaderboard_positions")
    .select("position, points, snapshot_date")
    .eq("player_id", playerId)
    .or("league.eq.global,league.eq.npl") // Adjust based on your slug naming
    .order("snapshot_date", { ascending: true });

  const currentRank = history && history.length > 0 
    ? history[history.length - 1].position 
    : null;

  // 6. Return formatted data
  return {
    player: {
      id: player.id,
      name: displayName(player.forename, player.surname, consent, player.display_name),
      avatar_url: player.avatar_url,
      consent,
    },
    stats: {
      lifetime_points,
      total_earnings,
      total_wins,
      current_rank: currentRank,
      results_count: allResults?.length || 0,
    },
    graph_data: (history || []).map((h: any) => ({
      date: h.snapshot_date,
      rank: h.position,
      points: h.points
    })),
    recent_results: (results || []).map((r: any) => ({
      id: r.id,
      points: r.points,
      prize_amount: r.prize_amount,
      position_of_prize: r.position_of_prize,
      created_at: r.created_at,
      event: r.events ? {
        id: r.events.id,
        name: r.events.name,
        start_date: r.events.start_date,
        site_name: r.events.site_name,
        buy_in_raw: r.events.buy_in_raw,
      } : null,
    })),
  };
}