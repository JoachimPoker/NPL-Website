import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Body = {
  id?: number | null;
  series_id: number;
  label: string;
  city?: string | null;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
};

export async function POST(req: Request) {
  try {
    const b = (await req.json()) as Body;
    const s = supabaseAdmin();
    const payload: any = {
      series_id: b.series_id,
      label: b.label.trim(),
      city: b.city || null,
      start_date: b.start_date,
      end_date: b.end_date,
      updated_at: new Date().toISOString()
    };

    let row: any;
    if (b.id) {
      const { data, error } = await s.from("festivals").update(payload).eq("id", b.id).select("*").maybeSingle();
      if (error) throw error;
      row = data;
    } else {
      payload.created_at = new Date().toISOString();
      const { data, error } = await s.from("festivals").insert(payload).select("*").maybeSingle();
      if (error) throw error;
      row = data;
    }

    return NextResponse.json({ festival: row });
  } catch (e: any) {
    return NextResponse.json({ _error: String(e?.message || e) }, { status: 500 });
  }
}
