import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const festivalId = searchParams.get("festival_id");
  const unassignedOnly = searchParams.get("unassigned_only") === "1";

  const supabase = await createSupabaseRouteClient();
  
  let query = supabase.from("events").select("id, name, start_date, is_high_roller").order("start_date", { ascending: false });

  if (festivalId) {
    query = query.eq("festival_id", festivalId);
  } else if (unassignedOnly) {
    query = query.is("festival_id", null);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, results: data });
}