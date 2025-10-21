// src/app/api/admin/seasons/upsert/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type SaveBody = {
  id?: number | null;
  label: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  method: "ALL" | "BEST_X";
  cap_x?: number | null;
  notes?: string | null;
  prize_bands?: Array<{ from: number; to?: number | null; text: string }>;
  is_active?: boolean;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SaveBody;
    const s = supabaseAdmin();

    // Normalize prize bands
    const bands = (body.prize_bands || []).map(b => ({
      from: Number(b.from),
      to: b.to == null ? Number(b.from) : Number(b.to),
      text: String(b.text || "").trim(),
    })).filter(b => b.from > 0 && b.to > 0 && b.text);

    const payload: any = {
      label: body.label.trim(),
      start_date: body.start_date,
      end_date: body.end_date,
      method: body.method,
      cap_x: body.method === "BEST_X" ? (Number(body.cap_x) || 20) : null,
      notes: body.notes ?? null,
      prize_bands: bands,
      is_active: !!body.is_active,
      updated_at: new Date().toISOString(),
    };

    let row: any = null;

    if (body.id) {
      const { data, error } = await s.from("seasons").update(payload).eq("id", body.id).select("*").maybeSingle();
      if (error) throw error;
      row = data;
    } else {
      payload.created_at = new Date().toISOString();
      const { data, error } = await s.from("seasons").insert(payload).select("*").maybeSingle();
      if (error) throw error;
      row = data;
    }

    return NextResponse.json({ season: row });
  } catch (e: any) {
    return NextResponse.json({ _error: String(e?.message || e) }, { status: 500 });
  }
}
