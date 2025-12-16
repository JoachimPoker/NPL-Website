// src/app/api/series/[id]/leaderboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const revalidate = 60;

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const { id } = params; // This is the series ID
  const searchParams = req.nextUrl.searchParams;
  const league = searchParams.get("league") === "hrl" ? "hrl" : "npl";

  const supabase = await createSupabaseRouteClient();

  const { data, error } = await supabase.rpc("leaderboard_for_series", {
    p_series_id: Number(id),
    p_league: league,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, rows: data });
}