// src/app/api/admin/seasons/delete/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { id } = (await req.json()) as { id: number };
    const s = supabaseAdmin();

    const { error } = await s.from("seasons").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ _error: String(e?.message || e) }, { status: 500 });
  }
}
