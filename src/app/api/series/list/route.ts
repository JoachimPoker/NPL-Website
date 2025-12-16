import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const revalidate = 0;

export async function GET() {
  const supabase = await createSupabaseRouteClient();
  
  const { data, error } = await supabase
    .from("series")
    .select("id, name, slug, description")
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ ok: false, _error: error.message }, { status: 500 });
  
  return NextResponse.json({ ok: true, series: data });
}