import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const s = supabaseAdmin();
    const { data, error } = await s
      .from("series")
      .select("id,name,slug,keywords,is_active,notes,created_at,updated_at")
      .order("name", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ series: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ _error: String(e?.message || e) }, { status: 500 });
  }
}
