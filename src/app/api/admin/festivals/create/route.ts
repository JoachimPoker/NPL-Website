import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const revalidate = 0;

/**
 * POST body:
 * {
 *   series_id: number,
 *   label: string,
 *   city?: string | null,
 *   start_date: string (YYYY-MM-DD),
 *   end_date:   string (YYYY-MM-DD)
 * }
 *
 * - Upserts on (series_id, start_date, end_date)
 * - If "label per series" unique is violated, we auto-disambiguate:
 *   label = `${label} ${start_date.substring(0,4)}`
 */
export async function POST(req: Request) {
  try {
    const s = supabaseAdmin();
    const body = await req.json().catch(() => ({}));

    const series_id = Number(body.series_id);
    const label = String(body.label || "").trim();
    const city = body.city == null ? null : String(body.city).trim() || null;
    const start_date = String(body.start_date || "").trim();
    const end_date = String(body.end_date || "").trim();

    // validate
    if (!Number.isFinite(series_id) || series_id <= 0) {
      return NextResponse.json({ _error: "Missing/invalid series_id" }, { status: 400 });
    }
    if (!label) {
      return NextResponse.json({ _error: "Missing label" }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start_date) || !/^\d{4}-\d{2}-\d{2}$/.test(end_date)) {
      return NextResponse.json({ _error: "Missing/invalid start_date or end_date" }, { status: 400 });
    }

    // fetch series.slug (nice to keep both id & slug in festivals)
    const { data: seriesRow, error: sErr } = await s
      .from("series")
      .select("slug")
      .eq("id", series_id)
      .maybeSingle();
    if (sErr) throw sErr;
    const series_slug = seriesRow?.slug || null;

    // 1st attempt: upsert by dates
    let { data, error } = await s
      .from("festivals")
      .upsert(
        [{
          series_id,
          series_slug,
          label,
          city,
          start_date,
          end_date,
        }],
        // MUST match the existing unique index exactly:
        { onConflict: "series_id,start_date,end_date" }
      )
      .select("*")
      .single();

    // Handle label unique per series (23505) by disambiguating label and inserting.
    // Supabase wraps PG errors, so we check `error?.message`.
    if (error && /unique|duplicate|23505/i.test(String(error.message || ""))) {
      // label clash; add year suffix
      const year = start_date.slice(0, 4);
      const newLabel = `${label} ${year}`;

      const retry = await s
        .from("festivals")
        .upsert(
          [{
            series_id,
            series_slug,
            label: newLabel,
            city,
            start_date,
            end_date,
          }],
          { onConflict: "series_id,start_date,end_date" }
        )
        .select("*")
        .single();

      data = retry.data;
      error = retry.error;
    }

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ _error: "Insert failed, no row returned" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, festival: data });
  } catch (e: any) {
    return NextResponse.json({ _error: String(e?.message || e) }, { status: 500 });
  }
}
