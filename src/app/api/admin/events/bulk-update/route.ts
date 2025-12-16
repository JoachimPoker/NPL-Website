import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event_ids, updates } = body;

    if (!event_ids || !Array.isArray(event_ids) || event_ids.length === 0) {
      return NextResponse.json({ ok: false, error: "No events selected" }, { status: 400 });
    }

    const supabase = await createSupabaseRouteClient();

    // Perform the update on all selected IDs
    const { error } = await supabase
      .from("events")
      .update(updates) // e.g. { is_high_roller: true }
      .in("id", event_ids);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}