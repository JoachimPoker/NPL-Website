// src/app/api/players/[id]/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const revalidate = 0;

type Season = {
  id: number;
  start_date: string;
  end_date: string;
  method: "ALL" | "BEST_X";
  cap_x: number | null;
  is_active: boolean;
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const s = supabaseAdmin();
  try {
    const { id } = await ctx.params;
    const playerId = String(id || "").trim();
    if (!playerId) {
      return NextResponse.json({ _error: "Missing player id" }, { status: 400 });
    }

    // 1) Load player + aliases
    const { data: p, error: pErr } = await s
      .from("players")
      .select(
        `
        id,
        forename,
        surname,
        display_name,
        avatar_url,
        created_at,
        player_aliases(alias)
      `
      )
      .eq("id", playerId)
      .maybeSingle();

    if (pErr) throw pErr;
    if (!p) return NextResponse.json({ _error: "Player not found" }, { status: 404 });

    const name =
      (p.display_name && String(p.display_name).trim()) ||
      [p.forename, p.surname].filter(Boolean).join(" ").trim() ||
      `Player ${playerId}`;

    const aliases = (p.player_aliases || []).map((a: any) => a.alias).filter(Boolean);

    // 2) Load recent results (JOIN events) — correct foreign order usage
    const { data: recentRows, error: rErr } = await s
      .from("results")
      .select(
        `
        id,
        event_id,
        points,
        events!inner(
          id,
          name,
          start_date,
          is_high_roller
        )
      `
      )
      .eq("player_id", playerId)
      .eq("is_deleted", false)
      .order("start_date", { ascending: false, foreignTable: "events" }) // <-- key fix
      .limit(25);

    if (rErr) throw rErr;

    const recent_results = (recentRows || []).map((row: any) => ({
      result_id: String(row.id),
      event_id: String(row.event_id),
      event_name: row.events?.name ?? "—",
      event_date: row.events?.start_date ?? null,
      is_high_roller: !!row.events?.is_high_roller,
      points: Number(row.points || 0),
    }));

    // 3) All-time aggregates (no join needed)
    const { data: allRows, error: aErr } = await s
      .from("results")
      .select("points")
      .eq("player_id", playerId)
      .eq("is_deleted", false)
      .limit(100000); // practical guard

    if (aErr) throw aErr;

    const allPts = (allRows || []).map((r: any) => Number(r.points || 0));
    const allSum = allPts.reduce((a, b) => a + b, 0);
    const allCnt = allPts.length;
    const allAvg = allCnt ? allSum / allCnt : 0;

    // 4) Current season aggregates (needs events join for date filter)
    const { data: season, error: sErr } = await s
      .from("seasons")
      .select("*")
      .eq("is_active", true)
      .maybeSingle<Season>();
    if (sErr) throw sErr;

    let seasonSum = 0,
      seasonCnt = 0,
      seasonAvg = 0,
      seasonLowestCounted = 0;

    if (season) {
      const { data: seasonRows, error: srErr } = await s
        .from("results")
        .select(
          `
          points,
          events!inner(start_date)
        `
        )
        .eq("player_id", playerId)
        .eq("is_deleted", false)
        .gte("events.start_date", season.start_date)
        .lte("events.start_date", season.end_date)
        .limit(100000);

      if (srErr) throw srErr;

      const sPts = (seasonRows || []).map((r: any) => Number(r.points || 0)).sort((a, b) => b - a);
      if (season.method === "BEST_X" && season.cap_x && season.cap_x > 0) {
        const used = sPts.slice(0, season.cap_x);
        seasonSum = used.reduce((a, b) => a + b, 0);
        seasonCnt = used.length;
        seasonAvg = seasonCnt ? seasonSum / seasonCnt : 0;
        seasonLowestCounted = seasonCnt ? used[used.length - 1] : 0;
      } else {
        seasonSum = sPts.reduce((a, b) => a + b, 0);
        seasonCnt = sPts.length;
        seasonAvg = seasonCnt ? seasonSum / seasonCnt : 0;
        seasonLowestCounted = seasonCnt ? sPts[sPts.length - 1] : 0;
      }
    }

    const profile = {
      id: p.id,
      name,
      avatar_url: p.avatar_url ?? null,
      bio: "",
      aliases,
      stats: {
        all_time: {
          total_points: Number(allSum.toFixed(2)),
          results: allCnt,
          avg_points: Number(allAvg.toFixed(2)),
        },
        current_season: {
          total_points: Number(seasonSum.toFixed(2)),
          results: seasonCnt,
          avg_points: Number(seasonAvg.toFixed(2)),
          lowest_counted: Number(seasonLowestCounted.toFixed(2)),
        },
      },
      recent_results,
    };

    return NextResponse.json({ profile });
  } catch (e: any) {
    return NextResponse.json(
      { _error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
