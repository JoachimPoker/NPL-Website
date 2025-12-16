// src/app/api/players/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseServer";
import { displayName } from "@/lib/nameMask";

export const dynamic = "force-dynamic";

type PlayerRow = {
  id: string;
  forename: string | null;
  surname: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

// ⚠️ CHANGE 1: 'params' is now a Promise
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseRouteClient();
  
  // ⚠️ CHANGE 2: Must await params to get the ID
  const { id } = await params;
  const playerId = id;

  // --- Track that this player was viewed ---
  try {
    await supabase.from("player_searches").insert({ player_id: playerId });
  } catch (error) {
    console.error("Error tracking player view:", error);
  }
  // ----------------------------------------

  // Fetch Player Basic Info
  const { data: player, error: pErr } = await supabase
    .from("players")
    .select("id, forename, surname, display_name, avatar_url")
    .eq("id", playerId)
    .single<PlayerRow>();

  if (pErr || !player) {
    return NextResponse.json({ error: pErr?.message || "Not found" }, { status: 404 });
  }

  // Check GDPR Consent
  const { data: consentRows, error: cErr } = await supabase
    .from("results")
    .select("gdpr_flag")
    .eq("player_id", playerId);
    
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
  const consent = (consentRows || []).some((r: any) => !!r.gdpr_flag);

  // Fetch Recent Results
  const { data: results, error: rErr } = await supabase
    .from("results")
    .select(`id, points, prize_amount, position_of_prize, created_at,
             events:event_id ( id, name, start_date, site_name, buy_in_raw )`)
    .eq("player_id", playerId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });

  // Calculate Lifetime Points
  const { data: ptsAgg } = await supabase
    .from("results")
    .select("points")
    .eq("player_id", playerId);
  const lifetime_points = (ptsAgg || []).reduce((acc: number, row: any) => acc + (Number(row.points) || 0), 0);

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