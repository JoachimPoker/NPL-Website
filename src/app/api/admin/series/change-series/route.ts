// src/app/api/admin/series/change-series/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const revalidate = 0;

/**
 * POST body: { event_id: string, series_slug: string | null }
 * - If series_slug is null: remove series assignment (events.series_id=null, events.festival_id=null) and delete event_series row.
 * - If series_slug is set: set events.series_id to the series.id for that slug AND clear events.festival_id,
 *   and upsert event_series (event_id, series_slug, festival_id=null).
 */
export async function POST(req: Request) {
  try {
    const s = supabaseAdmin();
    const body = await req.json().catch(() => ({} as any));
    const event_id = String(body.event_id || "").trim();
    const series_slug =
      body.series_slug === null ? null : String(body.series_slug || "").trim();

    if (!event_id) {
      return NextResponse.json({ _error: "Missing event_id" }, { status: 400 });
    }

    // Clear assignment completely
    if (!series_slug) {
      // 1) events: remove series & festival
      {
        const { error } = await s
          .from("events")
          .update({ series_id: null, festival_id: null })
          .eq("id", event_id);
        if (error) throw error;
      }
      // 2) event_series: delete mapping (best-effort)
      {
        const { error } = await s.from("event_series").delete().eq("event_id", event_id);
        if (error && error.code !== "42P01") {
          // ignore "relation does not exist" if you ever drop the table
          throw error;
        }
      }
      return NextResponse.json({ ok: true, cleared: 1 });
    }

    // Move to target series
    // 1) resolve series.id
    const { data: ser, error: sErr } = await s
      .from("series")
      .select("id, slug")
      .eq("slug", series_slug)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!ser?.id) {
      return NextResponse.json({ _error: "Series not found" }, { status: 404 });
    }

    // 2) events: set series_id = ser.id and clear festival_id
    {
      const { error } = await s
        .from("events")
        .update({ series_id: ser.id, festival_id: null })
        .eq("id", event_id);
      if (error) throw error;
    }

    // 3) event_series: upsert mapping to keep in sync (optional but nice)
    {
      const { error } = await s
        .from("event_series")
        .upsert({ event_id, series_slug: ser.slug, festival_id: null }, { onConflict: "event_id" });
      if (error && error.code !== "42P01") throw error;
    }

    return NextResponse.json({ ok: true, updated: 1, series_id: ser.id, series_slug: ser.slug });
  } catch (e: any) {
    return NextResponse.json({ _error: String(e?.message || e) }, { status: 500 });
  }
}
