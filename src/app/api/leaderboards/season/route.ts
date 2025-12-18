import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const revalidate = 60;

export async function GET(req: Request) {
  try {
    const supabase = await createSupabaseRouteClient();
    const url = new URL(req.url);
    const slug = url.searchParams.get("league") || "global"; 

    console.log(`📊 Leaderboard API: Requested slug '${slug}'`);

    // 1. Find the League ID based on the slug
    // We join with seasons to ensure we only get the ACTIVE season's league
    const { data: leagueData, error: leagueError } = await supabase
        .from("leagues")
        .select("id, label, seasons!inner(is_active)")
        .eq("slug", slug)
        .eq("seasons.is_active", true)
        .single();

    // If requested league not found, try to fallback to the first active league
    let finalLeague = leagueData;
    if (!finalLeague) {
        console.warn(`⚠️ League '${slug}' not found. Attempting fallback...`);
        const { data: fallbackLeague } = await supabase
            .from("leagues")
            .select("id, label, slug, seasons!inner(is_active)")
            .eq("seasons.is_active", true)
            .limit(1)
            .maybeSingle();
            
        if (fallbackLeague) {
             console.log(`🔄 Redirecting to fallback: ${fallbackLeague.slug}`);
             return NextResponse.redirect(new URL(`?league=${fallbackLeague.slug}`, req.url));
        }
        return NextResponse.json({ ok: false, error: "No active leagues found" }, { status: 404 });
    }

    // 2. ✅ CRITICAL FIX: Use the NEW function 'get_league_leaderboard'
    // The old 'leaderboard_season' function causes 500 errors on imported data
    console.log(`⚡ Calling get_league_leaderboard for ID: ${finalLeague.id}`);
    const { data: rows, error: rpcError } = await supabase
        .rpc("get_league_leaderboard", { p_league_id: finalLeague.id });

    if (rpcError) {
        console.error("❌ RPC Error:", rpcError);
        throw new Error(rpcError.message);
    }

    // 3. Pagination
    const limit = Number(url.searchParams.get("limit") || 100);
    const offset = Number(url.searchParams.get("offset") || 0);
    const search = (url.searchParams.get("search") || "").toLowerCase();

    let filtered = rows || [];
    if (search) {
        filtered = filtered.filter((r: any) => r.display_name.toLowerCase().includes(search));
    }

    const paginated = filtered.slice(offset, offset + limit);

    return NextResponse.json({
      ok: true,
      meta: {
        league: slug,
        label: finalLeague.label,
        total: filtered.length,
        limit,
        offset
      },
      rows: paginated,
    });

  } catch (e: any) {
    console.error("❌ Leaderboard API Error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}