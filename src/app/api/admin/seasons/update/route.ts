import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, label, start_date, end_date, is_active } = body; // Removed scoring fields

    if (!id) return NextResponse.json({ ok: false, error: "Missing ID" }, { status: 400 });
    if (new Date(start_date) > new Date(end_date)) {
      return NextResponse.json({ ok: false, error: "Start date cannot be after end date" }, { status: 400 });
    }

    const supabase = await createSupabaseRouteClient();

    if (is_active) {
      await supabase.from("seasons").update({ is_active: false }).neq("id", id);
    }

    const { error } = await supabase
      .from("seasons")
      .update({
        label,
        start_date,
        end_date,
        is_active
      })
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}