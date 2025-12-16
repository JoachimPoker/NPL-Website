// src/lib/data.ts
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

  // 2. Fetch Consent (Check if they have ANY result with gdpr_flag = true)
  const { data: consentRows } = await supabase
    .from("results")
    .select("gdpr_flag")
    .eq("player_id", playerId);
  
  const consent = (consentRows || []).some((r: any) => !!r.gdpr_flag);

  // 3. Fetch Recent Results (Last 30)
  const { data: results } = await supabase
    .from("results")
    .select(`id, points, prize_amount, position_of_prize, created_at,
             events:event_id ( id, name, start_date, site_name, buy_in_raw )`)
    .eq("player_id", playerId)
    .order("created_at", { ascending: false })
    .limit(30);

  // 4. Calculate Lifetime Points
  const { data: ptsAgg } = await supabase
    .from("results")
    .select("points")
    .eq("player_id", playerId);
    
  const lifetime_points = (ptsAgg || []).reduce((acc: number, row: any) => acc + (Number(row.points) || 0), 0);

  // 5. Return formatted data
  return {
    player: {
      id: player.id,
      name: displayName(player.forename, player.surname, consent, player.display_name),
      avatar_url: player.avatar_url,
      consent,
    },
    stats: {
      lifetime_points,
      recent_results_count: results?.length || 0,
    },
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