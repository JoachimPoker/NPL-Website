import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseServer";
import { displayName } from "@/lib/nameMask";

export const dynamic = "force-dynamic";

type PlayerRow = {
  id: number;
  forename: string | null;
  surname: string | null;
  display_name: string | null;
  avatar_url: string | null;
  gdpr: boolean | null;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> } // Fix 1
) {
  const { id } = await params; // Fix 2
  const playerId = Number(id);
  if (!Number.isFinite(playerId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  
  const supabase = await createSupabaseRouteClient();

  // Fetch Player Basic Info
  const { data: player, error: pErr } = await supabase
    .from("players")
    .select("id, forename, surname, display_name, avatar_url, gdpr")
    .eq("id", playerId)
    .single<PlayerRow>();

  if (pErr || !player) {
    return NextResponse.json({ error: pErr?.message || "Not found" }, { status: 404 });
  }

  // GDPR consent is stored per player
  const consent = !!player.gdpr;

  // Fetch Recent Results
  const { data: results, error: rErr } = await supabase
    .from("results")
    .select(`id, points, prize_amount, position_of_prize:finish_position, created_at,
             events:event_id ( id, name:tournament_name, start_date, site_name:casino, buy_in_raw:buy_in )`)
    .eq("player_id", playerId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(30);
  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });

  // Calculate Lifetime Points
  const { data: ptsAgg } = await supabase
    .from("results")
    .select("points, penalty_points")
    .eq("player_id", playerId)
    .eq("is_deleted", false);
  const lifetime_points = (ptsAgg || []).reduce((acc: number, row: any) => acc + (Number(row.points) || 0) + (Number(row.penalty_points) || 0), 0);

  // Return Data
  return NextResponse.json({
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
  });
}