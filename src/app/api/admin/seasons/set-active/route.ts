// src/app/api/admin/seasons/set-active/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { id } = (await req.json()) as { id: number };
    const s = supabaseAdmin();

    // Deactivate all others, activate this one
    const { error: e1 } = await s.from("seasons").update({ is_active: false }).neq("id", id);
    if (e1) throw e1;

    const { data, error: e2 } = await s.from("seasons").update({ is_active: true }).eq("id", id).select("*").maybeSingle();
    if (e2) throw e2;

    return NextResponse.json({ season: data });
  } catch (e: any) {
    return NextResponse.json({ _error: String(e?.message || e) }, { status: 500 });
  }
}
