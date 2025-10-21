import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const revalidate = 0;

type Body = {
  festival_id: string;       // uuid
  season_id: number | null;  // null to clear
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    if (!body?.festival_id) {
      return NextResponse.json({ _error: "festival_id required" }, { status: 400 });
    }

    const s = supabaseAdmin();
    const { error } = await s
      .from("festivals")
      .update({ season_id: body.season_id })
      .eq("id", body.festival_id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ _error: String(e?.message || e) }, { status: 500 });
  }
}
