import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isHRL(name: string|null|undefined, buy_in_raw: string|null|undefined) {
  const n = (name ?? "").toLowerCase();
  if (n.includes("high roller")) return true;
  const num = Number((buy_in_raw ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(num) && num >= 1000;
}

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const url = new URL(req.url);
  const seriesId   = (url.searchParams.get("seriesId") || url.searchParams.get("series") || url.searchParams.get("series_id") || "").trim();
  const festivalId = (url.searchParams.get("festivalId") || "").trim();

  let q = supabase.from("events").select("id,name,start_date,site_name,buy_in_raw,series_id,festival_id")
    .order("start_date", { ascending: true });

  if (festivalId) q = q.eq("festival_id", festivalId);
  if (seriesId)   q = q.eq("series_id", seriesId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const rows = (data ?? []).map(e => ({
    id: e.id,
    name: e.name,
    date: e.start_date,
    venue: e.site_name,
    is_high_roller: isHRL(e.name, e.buy_in_raw),
  }));

  return NextResponse.json({ ok: true, rows });
}
