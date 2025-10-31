import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SeasonRow = { id: number; label: string; start_date: string; end_date: string; method?: "ALL"|"BEST_X"|null; cap_x?: number|null; is_active?: boolean|null };

function bad(code: number, msg: string, extra?: any) {
  return NextResponse.json({ ok: false, error: msg, extra }, { status: code });
}

function iso(d?: string|null) {
  if (!d) return null;
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  return x.toISOString().slice(0,10);
}

function isHRL(name: string|null|undefined, buy_in_raw: string|null|undefined) {
  const n = (name ?? "").toLowerCase();
  if (n.includes("high roller")) return true;
  const num = Number((buy_in_raw ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(num) && num >= 1000;
}

function displayName(forename?: string|null, surname?: string|null, display_name?: string|null, consent?: boolean) {
  const f = (forename ?? "").trim();
  const s = (surname ?? "").trim();
  const d = (display_name ?? "").trim();
  if (consent) {
    const full = d || [f, s].filter(Boolean).join(" ").trim();
    return full || "Anonymous";
  }
  if (!f && !s) return "Anonymous";
  const fi = f ? f[0].toUpperCase()+"." : "";
  const si = s ? s[0].toUpperCase()+"." : "";
  return `${fi}${fi&&si?" ":""}${si}`.trim();
}

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const url = new URL(req.url);

  const seriesId = (url.searchParams.get("seriesId") || url.searchParams.get("id") || "").trim();
  if (!seriesId) return bad(400, "Missing seriesId");

  const scope = (url.searchParams.get("scope") || "season").toLowerCase(); // season | all-time
  const type  = (url.searchParams.get("type")  || "npl").toLowerCase();     // npl | hrl
  const mode  = (url.searchParams.get("mode")  || "simple").toLowerCase();  // simple | advanced (ignored here)
  const limit = Math.max(1, Math.min(5000, Number(url.searchParams.get("limit") || 100)));

  let from: string|null = null, to: string|null = null, cap = 20;
  if (scope === "season") {
    const seasonId = (url.searchParams.get("seasonId") || "current").trim();
    let season: SeasonRow | null = null;
    if (seasonId === "current") {
      const { data, error } = await supabase
        .from("seasons")
        .select("id,label,start_date,end_date,method,cap_x,is_active")
        .eq("is_active", true)
        .maybeSingle<SeasonRow>();
      if (error || !data) return bad(500, "Active season not found", { error: error?.message });
      season = data;
    } else {
      const sid = Number(seasonId);
      const { data, error } = await supabase
        .from("seasons")
        .select("id,label,start_date,end_date,method,cap_x,is_active")
        .eq("id", sid)
        .maybeSingle<SeasonRow>();
      if (error || !data) return bad(404, "Season not found", { error: error?.message });
      season = data;
    }
    from = iso(season!.start_date);
    to   = iso(season!.end_date);
    if (season?.method === "BEST_X") cap = Number(season.cap_x ?? cap);
  } else {
    // all-time
    const capParam = url.searchParams.get("cap");
    if (capParam) cap = Math.max(1, Math.min(1000, Number(capParam)));
  }

  // 1) Get events in this series (optionally inside season range)
  //    We try multiple possible column names for series mapping to be robust.
  const evSel = "id,name,start_date,buy_in_raw,site_name,series_id,festival_id";
  let evQuery = supabase.from("events").select(evSel);
  // match series id on possible columns
  evQuery = evQuery.or(`series_id.eq.${seriesId},series.eq.${seriesId},series_slug.eq.${seriesId}`);
  if (from) evQuery = evQuery.gte("start_date", from);
  if (to)   evQuery = evQuery.lte("start_date", to);
  const { data: events, error: evErr } = await evQuery;
  if (evErr) return bad(500, evErr.message);
  const evs = (events ?? []).filter(e => (type === "hrl") === isHRL(e.name, e.buy_in_raw));
  if (!evs.length) {
    return NextResponse.json({ ok: true, series: { id: seriesId, label: `Series ${seriesId}` }, rows: [] });
  }

  const eventIds = evs.map(e => e.id);

  // 2) Pull results for those events
  const { data: results, error: rErr } = await supabase
    .from("results")
    .select("player_id, event_id, points, position_of_prize, gdpr_flag")
    .in("event_id", eventIds);
  if (rErr) return bad(500, rErr.message);

  if (!results?.length) {
    return NextResponse.json({ ok: true, series: { id: seriesId, label: `Series ${seriesId}` }, rows: [] });
  }

  // 3) Build per-player aggregates in memory
  type R = { player_id: string; points: number|null; pop: number|null; consent: boolean };
  const byPlayer = new Map<string, R[]>();
  for (const r of results) {
    const pid = String(r.player_id ?? "");
    if (!pid) continue;
    const arr = byPlayer.get(pid) ?? [];
    arr.push({ player_id: pid, points: r.points as any, pop: (r as any).position_of_prize ?? null, consent: !!r.gdpr_flag });
    byPlayer.set(pid, arr);
  }

  // 4) Fetch names for those players
  const playerIds = Array.from(byPlayer.keys());
  const { data: players, error: pErr } = await supabase
    .from("players")
    .select("id,forename,surname,display_name")
    .in("id", playerIds);
  if (pErr) return bad(500, pErr.message);
  const pMap = new Map(players?.map(p => [p.id, p]) ?? []);

  // 5) compute metrics
  type Row = {
    player_id: string; name: string; total_points: number;
    used_count: number; total_count: number;
    average_used: number; average_all: number;
    best_single: number; lowest_counted: number;
    wins: number; top3_count: number; top9_count: number;
  };
  const rows: Row[] = [];

  for (const [pid, arr] of byPlayer) {
    const pts = arr.map(a => Number(a.points || 0)).sort((a,b) => b - a);
    const total_count = pts.length;
    const used_cap = scope === "all-time" ? cap : total_count; // season mode = ALL by default
    const used_count = Math.min(used_cap, total_count);
    const sum_used = pts.slice(0, used_count).reduce((s,n)=>s+n,0);
    const sum_all  = pts.reduce((s,n)=>s+n,0);
    const best_single = pts[0] ?? 0;
    const lowest_counted = pts[used_count-1] ?? 0;

    const wins = arr.reduce((s,a)=> s + (a.pop === 1 ? 1 : 0), 0);
    const top3 = arr.reduce((s,a)=> s + (a.pop != null && a.pop <= 3 ? 1 : 0), 0);
    const top9 = arr.reduce((s,a)=> s + (a.pop != null && a.pop <= 9 ? 1 : 0), 0);
    const consent = arr.some(a => a.consent);

    const p = pMap.get(pid) as any;
    const name = displayName(p?.forename, p?.surname, p?.display_name, consent);

    rows.push({
      player_id: pid, name,
      total_points: sum_used,
      used_count, total_count,
      average_used: used_count ? sum_used/used_count : 0,
      average_all: total_count ? sum_all/total_count : 0,
      best_single, lowest_counted,
      wins, top3_count: top3, top9_count: top9,
    });
  }

  rows.sort((a,b) =>
    b.total_points - a.total_points
    || b.best_single - a.best_single
    || b.average_used - a.average_used
    || b.total_count - a.total_count
  );

  // dense ranks
  let lastKey = "__";
  let pos = 0;
  let seen = 0;
  const out = rows.slice(0, limit).map(r => {
    seen++;
    const key = `${r.total_points}|${r.best_single}|${r.average_used}|${r.total_count}`;
    if (key !== lastKey) { pos++; lastKey = key; }
    return {
      position: pos,
      player_id: r.player_id,
      name: r.name,
      total_points: Number(r.total_points.toFixed(2)),
      results_display: `${r.used_count} (${r.total_count})`,
      average_display: r.total_count !== r.used_count
        ? `${r.average_used.toFixed(2)} (${r.average_all.toFixed(2)})`
        : r.average_used.toFixed(2),
      lowest_points: Number(r.lowest_counted.toFixed(2)),
      top_results: undefined, // optional
      // extra fields your UI ignores but nice to have:
      used_count: r.used_count,
      total_count: r.total_count,
      average_used: Number(r.average_used.toFixed(4)),
      average_all: Number(r.average_all.toFixed(4)),
      best_single: Number(r.best_single.toFixed(2)),
      wins: r.wins,
      top3_count: r.top3_count,
      top9_count: r.top9_count,
    };
  });

  return NextResponse.json({
    ok: true,
    series: { id: seriesId, label: `Series ${seriesId}` },
    rows: out,
    meta: { scope, type, mode, limit }
  });
}
