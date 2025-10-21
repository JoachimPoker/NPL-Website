// src/app/api/admin/series/[id]/events/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const s = supabaseAdmin();
  try {
    const { id } = await ctx.params;
    const seriesId = Number(String(id || "").trim());
    if (!Number.isFinite(seriesId)) {
      return NextResponse.json({ events: [], _error: "Bad series id" }, { status: 400 });
    }

    const { data, error } = await s
      .from("events")
      .select("id,name,start_date,series_id,festival_id,is_deleted")
      .eq("series_id", seriesId)
      .not("is_deleted", "is", true)
      .order("start_date", { ascending: true });

    if (error) throw error;

    const events = (data ?? []).map((e: any) => ({
      id: String(e.id),
      tournament_name: e.name ?? null,
      start_date: e.start_date ?? null,
      series_id: e.series_id ?? null,
      festival_id: e.festival_id ?? null,
    }));

    return NextResponse.json({ events });
  } catch (e: any) {
    return NextResponse.json({ events: [], _error: e?.message || String(e) }, { status: 500 });
  }
}
