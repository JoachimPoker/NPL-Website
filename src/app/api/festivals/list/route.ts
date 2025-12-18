import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const seriesIdParam = searchParams.get("series_id"); // This is a string

  const supabase = await createSupabaseRouteClient();
  
  let query = supabase.from("festivals").select("*").order("start_date", { ascending: true });

  if (seriesIdParam) {
    // FIX: Convert string to number
    const seriesId = Number(seriesIdParam);
    
    // Only apply filter if it's a valid number
    if (!isNaN(seriesId)) {
      query = query.eq("series_id", seriesId);
    }
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ ok: false, _error: error.message }, { status: 500 });
  
  return NextResponse.json({ ok: true, festivals: data });
}