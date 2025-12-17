import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      id, label, slug, scoring_method, scoring_cap, 
      filter_is_high_roller, max_buy_in, // ✅ Added max_buy_in
      bonus_b2b, bonus_over_cap 
    } = body;

    const supabase = await createSupabaseRouteClient();

    // 1. Update League Details
    const { error } = await supabase
      .from("leagues")
      .update({
        label,
        slug: slug.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        scoring_method,
        scoring_cap: Number(scoring_cap || 0),
        filter_is_high_roller,
        max_buy_in: max_buy_in ? Number(max_buy_in) : null // ✅ Added
      })
      .eq("id", id);

    if (error) throw error;

    // 2. Update Bonuses
    await supabase.from("league_bonuses").delete().eq("league_id", id);

    const bonuses = [];
    if (Number(bonus_b2b) > 0) {
      bonuses.push({ league_id: id, bonus_type: 'back_to_back_wins', points_value: Number(bonus_b2b) });
    }
    if (Number(bonus_over_cap) > 0) {
      bonuses.push({ league_id: id, bonus_type: 'participation_after_cap', points_value: Number(bonus_over_cap) });
    }

    if (bonuses.length > 0) {
      await supabase.from("league_bonuses").insert(bonuses);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}