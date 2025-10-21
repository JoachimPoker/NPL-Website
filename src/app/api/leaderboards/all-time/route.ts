import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const revalidate = 0;

type Row = {
  player_id: string;
  points: number;
  gdpr_flag: boolean;
  players: { forename: string | null; surname: string | null } | null;
  events: { is_high_roller: boolean | null } | null;
};

function nameFromGdpr(f: string | null, s: string | null, anyYes: boolean) {
  const fn = (f || "").trim();
  const sn = (s || "").trim();
  if (anyYes) return [fn, sn].filter(Boolean).join(" ").trim() || "Unknown";
  if (fn && sn) return `${fn[0].toUpperCase()}.${sn[0].toUpperCase()}.`;
  return (fn || sn || "Unknown").trim();
}

function aggregate(rows: Row[], method: "ALL" | "BEST_X", capX?: number, advanced?: boolean) {
  const byPlayer = new Map<string, { pts: number[]; f: string | null; s: string | null; any: boolean }>();
  for (const r of rows) {
    const p = byPlayer.get(r.player_id);
    const v = Number(r.points || 0);
    if (p) {
      p.pts.push(v);
      if (r.gdpr_flag) p.any = true;
    } else {
      byPlayer.set(r.player_id, { pts: [v], f: r.players?.forename ?? null, s: r.players?.surname ?? null, any: !!r.gdpr_flag });
    }
  }

  const out: any[] = [];
  for (const [pid, v] of byPlayer.entries()) {
    const pts = v.pts.slice().sort((a, b) => b - a);
    const totalAll = pts.reduce((a, b) => a + b, 0);
    const countAll = pts.length;
    const avgAll = countAll ? totalAll / countAll : 0;
    const lowestAll = countAll ? pts[pts.length - 1] : 0;

    let used = pts, countCap = countAll, totalUsed = totalAll, avgCap = avgAll, lowCap = lowestAll;
    if (method === "BEST_X" && capX && capX > 0) {
      used = pts.slice(0, capX);
      countCap = Math.min(capX, pts.length);
      totalUsed = used.reduce((a, b) => a + b, 0);
      avgCap = countCap ? totalUsed / countCap : 0;
      lowCap = countCap ? used[used.length - 1] : 0;
    }

    out.push({
      player_id: pid,
      name: nameFromGdpr(v.f, v.s, v.any),
      total_points: Number(totalUsed.toFixed(2)),
      results_display: method === "BEST_X" && capX ? `${countCap} (${countAll})` : `${countAll}`,
      average_display: method === "BEST_X" && capX ? `${avgCap.toFixed(2)} (${avgAll.toFixed(2)})` : `${avgAll.toFixed(2)}`,
      lowest_points: Number((method === "BEST_X" && capX ? lowCap : lowestAll).toFixed(2)),
      top_results: advanced && method === "BEST_X" && capX ? used.map(n => Number(n.toFixed(2))) : [],
    });
  }

  out.sort((a, b) => b.total_points - a.total_points);
  out.forEach((r, i) => (r.position = i + 1));
  return out;
}

async function fetchAllAllTimeRows(kind: "npl" | "hrl") {
  const s = supabaseAdmin();
  const PAGE = 1000; // <-- important
  const rows: Row[] = [];
  let from = 0;

  const selectNpl =
    "player_id, points, gdpr_flag, players!inner(forename,surname), events(is_high_roller)";
  const selectHrl =
    "player_id, points, gdpr_flag, players!inner(forename,surname), events!inner(is_high_roller)";

  while (true) {
    let q = s
      .from("results")
      .select(kind === "hrl" ? selectHrl : selectNpl)
      .eq("is_deleted", false)
      .order("player_id", { ascending: true })
      .range(from, from + PAGE - 1);

    if (kind === "hrl") q = q.eq("events.is_high_roller", true);

    const { data, error } = await q;
    if (error) throw error;

    const batch = (data as any[]).map((r) => ({
      player_id: r.player_id as string,
      points: Number(r.points ?? 0),
      gdpr_flag: !!r.gdpr_flag,
      players: (r.players ?? null) as Row["players"],
      events: (r.events ?? null) as Row["events"],
    }));

    rows.push(...batch);
    from += PAGE;
    if (batch.length < PAGE) break;
  }

  return rows;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const kind = (url.searchParams.get("type") || "npl").toLowerCase() as "npl" | "hrl";
    const methodParam = (url.searchParams.get("method") || "ALL").toUpperCase() as "ALL" | "BEST_X";
    const capX = Number(url.searchParams.get("cap") || "20");
    const advanced = (url.searchParams.get("mode") || "simple").toLowerCase() === "advanced";
    const limit = Math.max(1, Math.min(10000, Number(url.searchParams.get("limit") || "1000")));
    const debug = url.searchParams.get("debug") === "1";

    const rows = await fetchAllAllTimeRows(kind);

    if (advanced && methodParam !== "BEST_X") {
      return NextResponse.json({ leaderboard: [], _error: "Advanced view requires BEST_X" });
    }

    const leaderboard = aggregate(
      rows,
      methodParam,
      methodParam === "BEST_X" ? capX : undefined,
      advanced
    ).slice(0, limit);

    return NextResponse.json({
      leaderboard,
      ...(debug ? { _debug: { total_rows_scanned: rows.length } } : {}),
    });
  } catch (e: any) {
    return NextResponse.json({ leaderboard: [], _error: String(e?.message || e) });
  }
}
