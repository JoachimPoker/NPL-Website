import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const idParam = searchParams.get("id");

  if (!idParam) {
    return NextResponse.json({ ok: false, error: "Missing ID" }, { status: 400 });
  }

  // FIX: Convert string param to number
  const id = Number(idParam);
  if (isNaN(id)) {
    return NextResponse.json({ ok: false, error: "Invalid ID" }, { status: 400 });
  }

  const supabase = await createSupabaseRouteClient();
  
  // Fetch series by ID
  const { data, error } = await supabase
    .from("series")
    .select("*")
    .eq("id", id) // Now passing a number
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, series: data });
}