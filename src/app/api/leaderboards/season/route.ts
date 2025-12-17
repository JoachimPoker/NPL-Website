import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const revalidate = 60;

export async function GET(req: Request) {
  try {
    const supabase = await createSupabaseRouteClient();
    const url = new URL(req.url);
    const slug = url.searchParams.get("league") || "global"; // Default to 'global'

    // 1. Find the League ID based on the slug
    // We join with seasons to ensure we only get the ACTIVE season's league
    const { data: leagueData, error: leagueError } = await supabase
        .from("leagues")
        .select("id, label, seasons!inner(is_active)")
        .eq("slug", slug)
        .eq("seasons.is_active", true)
        .single();

    if (leagueError || !leagueData) {
        return NextResponse.json({ ok: false, error: "League not found in active season" }, { status: 404 });
    }

    // 2. Use the central SQL function (Same as Home Page)
    const { data: rows, error: rpcError } = await supabase
        .rpc("get_league_leaderboard", { p_league_id: leagueData.id });

    if (rpcError) throw rpcError;

    // 3. Pagination (Done in JS for simplicity, as list is usually < 5000)
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
        label: leagueData.label,
        total: filtered.length,
        limit,
        offset
      },
      rows: paginated,
    });

  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}