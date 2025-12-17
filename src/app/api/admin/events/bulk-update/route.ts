import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  
  try {
    const body = await req.json();
    const { updates } = body; // Array of { id, is_high_roller, series_id }

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    // Process updates
    for (const up of updates) {
      await supabase
        .from("events")
        .update({ 
          is_high_roller: up.is_high_roller,
          series_id: up.series_id || null
        })
        .eq("id", up.id);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}