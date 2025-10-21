import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const revalidate = 0;

/**
 * POST body:
 * {
 *   id: string (uuid),
 *   label: string,
 *   city?: string | null,
 *   start_date: string (YYYY-MM-DD),
 *   end_date:   string (YYYY-MM-DD)
 * }
 *
 * - Updates the existing festival in-place.
 * - If the (series_id, label) unique is violated, it auto-disambiguates by adding " YYYY".
 */
export async function POST(req: Request) {
  try {
    const s = supabaseAdmin();
    const body = await req.json().catch(() => ({}));

    const id = String(body.id || "").trim();
    const label = String(body.label || "").trim();
    const city = body.city == null ? null : String(body.city).trim() || null;
    const start_date = String(body.start_date || "").trim();
    const end_date = String(body.end_date || "").trim();

    if (!id) return NextResponse.json({ _error: "Missing id" }, { status: 400 });
    if (!label) return NextResponse.json({ _error: "Missing label" }, { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start_date) || !/^\d{4}-\d{2}-\d{2}$/.test(end_date)) {
      return NextResponse.json({ _error: "Missing/invalid start_date or end_date" }, { status: 400 });
    }

    // Ensure the festival exists and get its series_id for label disambiguation
    const { data: existing, error: exErr } = await s
      .from("festivals")
      .select("id, series_id")
      .eq("id", id)
      .maybeSingle();
    if (exErr) throw exErr;
    if (!existing) return NextResponse.json({ _error: "Festival not found" }, { status: 404 });

    // Attempt the update
    let { data, error } = await s
      .from("festivals")
      .update({ label, city, start_date, end_date })
      .eq("id", id)
      .select("*")
      .single();

    // Handle unique label per series clash, retry with disambiguated label
    if (error && /unique|duplicate|23505/i.test(String(error.message || ""))) {
      const year = start_date.slice(0, 4);
      const newLabel = `${label} ${year}`;
      const retry = await s
        .from("festivals")
        .update({ label: newLabel, city, start_date, end_date })
        .eq("id", id)
        .select("*")
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) throw error;
    if (!data) return NextResponse.json({ _error: "Update failed" }, { status: 500 });

    return NextResponse.json({ ok: true, festival: data });
  } catch (e: any) {
    return NextResponse.json({ _error: String(e?.message || e) }, { status: 500 });
  }
}
