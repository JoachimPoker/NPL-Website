import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();

    // 1. Auth Check
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { ids, festival_id } = body; // 'ids' are result IDs

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No IDs provided" }, { status: 400 });
    }

    // 2. Resolve Event IDs from the selected Results
    // We cannot update 'results' directly because 'festival_id' lives on the 'events' table.
    const { data: results, error: fetchErr } = await supabase
      .from("results")
      .select("event_id")
      .in("id", ids);

    if (fetchErr) throw fetchErr;

    // Get unique event IDs
    const eventIds = Array.from(new Set(results.map((r) => r.event_id).filter(Boolean)));

    if (eventIds.length === 0) {
      return NextResponse.json({ ok: true, message: "No linked events found." });
    }

    // 3. Update the Events
    const { error: updateErr } = await supabase
      .from("events")
      .update({ 
        festival_id: festival_id || null,
        updated_at: new Date().toISOString()
      })
      .in("id", eventIds);

    if (updateErr) throw updateErr;

    return NextResponse.json({ ok: true, count: eventIds.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}