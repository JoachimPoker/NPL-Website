// src/app/api/admin/seasons/list/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const revalidate = 0;

export async function GET() {
  try {
    const s = supabaseAdmin();
    const { data, error } = await s
      .from("seasons")
      .select("id,label,start_date,end_date,method,cap_x,is_active,notes,prize_bands,created_at,updated_at")
      .order("start_date", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ seasons: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ seasons: [], _error: String(e?.message || e) }, { status: 500 });
  }
}
