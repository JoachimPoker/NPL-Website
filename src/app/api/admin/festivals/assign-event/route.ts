import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Body = { event_id: string; series_id: number; festival_id: number | null };

export async function POST(req: Request) {
  try {
    const { event_id, series_id, festival_id } = (await req.json()) as Body;
    const s = supabaseAdmin();

    const { error: e1 } = await s.from("events").update({
      series_id,
      festival_id
    }).eq("id", event_id);
    if (e1) throw e1;

    // record override
    await s.from("event_series_overrides").insert({
      event_id, series_id, festival_id, reason: "manual"
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ _error: String(e?.message || e) }, { status: 500 });
  }
}
