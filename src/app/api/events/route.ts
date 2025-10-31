import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const url = new URL(req.url);
  const mode = (url.searchParams.get("mode") || "upcoming").toLowerCase();
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") || (mode === "recent" ? 50 : 100))));

  if (mode === "recent") {
    const { data, error } = await supabase
      .from("events")
      .select("id, name, start_date, site_name, buy_in_raw")
      .lte("start_date", new Date().toISOString().slice(0,10))
      .order("start_date", { ascending: false })
      .limit(limit);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, rows: data });
  }

  // upcoming (default)
  const { data, error } = await supabase
    .from("events")
    .select("id, name, start_date, site_name, buy_in_raw")
    .gte("start_date", new Date().toISOString().slice(0,10))
    .order("start_date", { ascending: true })
    .limit(limit);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, rows: data });
}
