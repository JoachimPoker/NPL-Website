import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const limit = Math.min(Number(searchParams.get("limit") || 50), 200);
    const offset = Math.max(Number(searchParams.get("offset") || 0), 0);

    const s = supabaseAdmin();

    let query = s.from("players")
      .select("id,slug,display_name,country,is_active,created_at,updated_at", { count: "exact" })
      .order("display_name", { ascending: true });

    if (q) {
      // simple ILIKE filter (fast enough to start; we can move to full-text later)
      query = query.ilike("display_name", `%${q}%`);
    }

    const { data, count, error } = await query.range(offset, offset + limit - 1);
    if (error) throw error;

    return NextResponse.json({
      players: data ?? [],
      total: count ?? 0,
      limit,
      offset
    });
  } catch (e: any) {
    return NextResponse.json({ _error: e?.message || String(e) }, { status: 500 });
  }
}
