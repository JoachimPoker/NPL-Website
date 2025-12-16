import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      season_id, label, slug, scoring_method, scoring_cap, 
      filter_is_high_roller, bonus_b2b, bonus_over_cap 
    } = body;

    const supabase = await createSupabaseRouteClient();

    // 1. Create League
    const { data: league, error } = await supabase
      .from("leagues")
      .insert({
        season_id,
        label,
        slug: slug.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        scoring_method,
        scoring_cap: Number(scoring_cap || 0),
        filter_is_high_roller: filter_is_high_roller === "all" ? null : filter_is_high_roller === "true"
      })
      .select()
      .single();

    if (error) throw error;

    // 2. Add Bonuses
    const bonuses = [];
    if (Number(bonus_b2b) > 0) {
      bonuses.push({ league_id: league.id, bonus_type: 'back_to_back_wins', points_value: Number(bonus_b2b) });
    }
    if (Number(bonus_over_cap) > 0) {
      bonuses.push({ league_id: league.id, bonus_type: 'participation_after_cap', points_value: Number(bonus_over_cap) });
    }

    if (bonuses.length > 0) {
      await supabase.from("league_bonuses").insert(bonuses);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}