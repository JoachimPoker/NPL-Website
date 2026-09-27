import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { label, start_date, end_date, is_active } = body; // Removed scoring fields

    if (new Date(start_date) > new Date(end_date)) {
      return NextResponse.json({ ok: false, error: "Start date cannot be after end date" }, { status: 400 });
    }

    const supabase = await createSupabaseRouteClient();

    if (is_active) {
      await supabase.from("seasons").update({ is_active: false }).neq("id", -1);
    }

    // Insert only Season fields
    const { data, error } = await supabase.from("seasons").insert({
      name: label,
      year: new Date(end_date).getFullYear(), // seasons are named after the year they end in
      start_date,
      end_date,
      is_active
    }).select().single();

    if (error) throw error;

    // Create the main league for this new season (add others from the season page)
    await supabase.from("leagues").insert({
      season_id: data.id,
      label: "National Poker League",
      slug: "npl",
      scoring_method: "total",
      scoring_cap: 0
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}