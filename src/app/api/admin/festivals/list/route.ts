import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const s = supabaseAdmin();

    const seriesIdParam = (url.searchParams.get("series_id") || "").trim();
    const seriesSlugParam = (url.searchParams.get("series_slug") || "").trim();

    let series_slug = seriesSlugParam;
    if (!series_slug && seriesIdParam) {
      const idNum = Number(seriesIdParam);
      if (Number.isFinite(idNum)) {
        const { data, error } = await s
          .from("series")
          .select("slug")
          .eq("id", idNum)
          .maybeSingle();
        if (error) throw error;
        series_slug = data?.slug || "";
      }
    }

    if (!series_slug) {
      return NextResponse.json({ festivals: [] });
    }

    const { data, error } = await s
      .from("festivals")
      .select("id, series_slug, label, city, start_date, end_date, season_id") // ← include season_id
      .eq("series_slug", series_slug)
      .order("start_date", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ festivals: data || [] });
  } catch (e: any) {
    return NextResponse.json({ _error: String(e?.message || e) }, { status: 500 });
  }
}
