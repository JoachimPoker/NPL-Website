import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const revalidate = 0;

/**
 * POST body: { id: string }
 * - Deletes the festival and sets festival_id = null on related events (ON DELETE SET NULL is ideal if FK is set).
 */
export async function POST(req: Request) {
  try {
    const s = supabaseAdmin();
    const body = await req.json().catch(() => ({}));
    const id = String(body.id || "").trim();
    if (!id) return NextResponse.json({ _error: "Missing id" }, { status: 400 });

    // Clear event references first if FK isn't set to SET NULL
    await s.from("event_series").update({ festival_id: null }).eq("festival_id", id);

    const { error } = await s.from("festivals").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ _error: String(e?.message || e) }, { status: 500 });
  }
}
