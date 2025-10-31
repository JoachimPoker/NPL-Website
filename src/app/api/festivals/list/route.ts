import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const url = new URL(req.url);
  const seriesId = (url.searchParams.get("seriesId") || url.searchParams.get("series") || url.searchParams.get("series_id") || "").trim();

  let q = supabase.from("festivals").select("id,label,start_date,end_date,series_id").order("start_date", { ascending: false });
  if (seriesId) q = q.eq("series_id", seriesId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, rows: data ?? [] });
}
