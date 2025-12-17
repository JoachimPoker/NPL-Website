import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const revalidate = 60;

export async function GET(req: Request) {
  try {
    const supabase = await createSupabaseRouteClient();
    const url = new URL(req.url);
    const slug = url.searchParams.get("league") || "global"; 

    // 1. Find League ID (with Fallback)
    let { data: leagueData } = await supabase
        .from("leagues")
        .select("id, label, slug")
        .eq("slug", slug)
        .single();

    if (!leagueData) {
        // Fallback: Get first active league
        const { data: fallback } = await supabase
            .from("leagues")
            .select("id, label, slug")
            .limit(1)
            .maybeSingle();
        
        if (fallback) return NextResponse.redirect(new URL(`?league=${fallback.slug}`, req.url));
        return NextResponse.json({ ok: false, error: "No leagues found" }, { status: 404 });
    }

    // 2. ✅ Call NEW Function
    const { data: rows, error } = await supabase.rpc("get_league_leaderboard", { p_league_id: leagueData.id });

    if (error) throw error;

    // 3. Simple Search/Pagination
    const search = (url.searchParams.get("search") || "").toLowerCase();
    let filtered = (rows || []).filter((r: any) => !search || r.display_name.toLowerCase().includes(search));
    
    return NextResponse.json({
      ok: true,
      meta: { league: leagueData.slug, label: leagueData.label, total: filtered.length },
      rows: filtered.slice(0, 100),
    });

  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}