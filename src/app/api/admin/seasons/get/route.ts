import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseServer";

export const revalidate = 0;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const idParam = searchParams.get("id"); // This is a string

  if (!idParam) {
    return NextResponse.json({ ok: false, error: "Missing ID" }, { status: 400 });
  }

  // FIX: Convert string to number
  const id = Number(idParam);
  if (isNaN(id)) {
    return NextResponse.json({ ok: false, error: "Invalid ID format" }, { status: 400 });
  }

  const supabase = await createSupabaseRouteClient();

  // Fetch Season + Leagues + Bonuses
  const { data, error } = await supabase
    .from("seasons")
    .select(`
      *,
      leagues (
        *,
        league_bonuses (*)
      )
    `)
    .eq("id", id) // Now passing a number
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Sort leagues by ID or Label so they don't jump around
  if (data.leagues) {
    data.leagues.sort((a: any, b: any) => a.id - b.id);
  }

  return NextResponse.json({ ok: true, season: data });
}