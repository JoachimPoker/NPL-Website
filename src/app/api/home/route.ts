import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const revalidate = 0;

type Season = {
  id: number;
  label: string;
  start_date: string;
  end_date: string;
  method?: "ALL" | "BEST_X" | null;
  cap_x?: number | null;
  is_active: boolean | null;
};

function bad(code: number, msg: string, extra?: any) {
  return NextResponse.json({ 
    ok: false, 
    error: msg, 
    extra,
    leagues: [],
    leaderboards: { npl: [], hrl: [] },
    trending_players: [],
    biggest_gainers: []
  }, { status: code });
}

function fullNameFrom(player?: any, fallback: string = "") {
  const dn = (player?.display_name || "").trim();
  if (dn) return dn;
  const composed = [player?.forename, player?.surname].filter(Boolean).join(" ").trim();
  return composed || fallback || "Anonymous";
}

function toInitials(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Anonymous";
  if (parts.length === 1) return `${parts[0]![0]?.toUpperCase() ?? "A"}.`;
  const first = parts[0]?.[0]?.toUpperCase() ?? "";
  const last = parts[parts.length - 1]?.[0]?.toUpperCase() ?? "";
  return `${first}. ${last}.`;
}

export async function GET() {
  try {
    const supabase = await createSupabaseRouteClient();

    // 1. Get Active Season
    const { data: seasonRow } = await supabase.from("seasons").select("*").eq("is_active", true).maybeSingle();
    const season = (seasonRow as any) || { 
      id: 0,
      label: "Current", 
      start_date: '2025-01-01', 
      end_date: '2025-12-31', 
      method: "ALL", 
      cap_x: 0 
    };
    
    const from = season.start_date.slice(0, 10);
    const to = season.end_date.slice(0, 10);

    // 2. Fetch Data (Removed datesRes from here to do it manually below)
    const [nplRes, hrlRes, trendingRes, gainersRes] = await Promise.all([
      supabase.rpc("leaderboard_season", { p_from: from, p_to: to, p_league: "npl", p_method: season.method ?? "ALL", p_cap: season.cap_x ?? 0 }),
      supabase.rpc("leaderboard_season", { p_from: from, p_to: to, p_league: "hrl", p_method: "ALL", p_cap: 0 }),
      supabase.rpc("rpc_trending_players_last30"),
      supabase.rpc("rpc_biggest_gainers_week", { p_league: "npl" })
    ]);

    // 3. Movement Logic: Smart Date Fetching
    // Step A: Get the absolute latest date
    const { data: latestRows } = await supabase
      .from("leaderboard_positions")
      .select("snapshot_date")
      .order("snapshot_date", { ascending: false })
      .limit(1);
    
    const latestDate = latestRows?.[0]?.snapshot_date;

    // Step B: Get the first date OLDER than the latest date (The "Previous" Snapshot)
    let previousDate = undefined;
    if (latestDate) {
      const { data: prevRows } = await supabase
        .from("leaderboard_positions")
        .select("snapshot_date")
        .lt("snapshot_date", latestDate) // Less than latest
        .order("snapshot_date", { ascending: false })
        .limit(1);
      previousDate = prevRows?.[0]?.snapshot_date;
    }

    let movementMap = new Map<string, number>();

    if (latestDate) {
      // Step C: Limit lookup to Top 50 to respect Supabase limits
      const topNpl = (nplRes.data || []).slice(0, 50);
      const topHrl = (hrlRes.data || []).slice(0, 50);
      const activeIds = [...topNpl, ...topHrl].map(r => String(r.player_id));
      
      const { data: posData } = await supabase
        .from("leaderboard_positions")
        .select("player_id, position, snapshot_date, league")
        .in("snapshot_date", [latestDate, previousDate].filter(Boolean))
        .in("player_id", activeIds);

      if (previousDate) {
        // Scenario A: Compare Feb 10 vs Feb 03
        const latestPos = posData?.filter(p => p.snapshot_date === latestDate) || [];
        const previousPos = posData?.filter(p => p.snapshot_date === previousDate) || [];
        
        latestPos.forEach(lp => {
          const pid = String(lp.player_id).trim();
          const prev = previousPos.find(pp => String(pp.player_id).trim() === pid && pp.league === lp.league);
          if (prev) {
            // Movement = Old (54) - New (7) = +47
            movementMap.set(`${lp.league}-${pid}`, prev.position - lp.position);
          }
        });
      } else {
        // Scenario B: Only one date exists. Compare Snapshot vs Live Rank.
        // (This runs if you wipe the DB and upload only one file)
        posData?.forEach(p => {
           movementMap.set(`${p.league}-${String(p.player_id).trim()}`, p.position);
        });
      }
    }

    const formatRows = (rows: any[], league: string) => {
      return (rows || []).map((r: any) => {
        const pid = String(r.player_id).trim();
        const mapVal = movementMap.get(`${league}-${pid}`);
        
        let moveValue = 0;
        if (previousDate) {
          // Snap vs Snap: The map value IS the movement
          moveValue = mapVal || 0;
        } else if (mapVal) {
          // Snap vs Live: Old (Map) - Current (r.position)
          moveValue = mapVal - r.position;
        }
        
        return {
          ...r,
          events_played: r.total_count || r.events_played || 0,
          movement: moveValue 
        };
      });
    };

    const nplRows = formatRows(nplRes.data || [], "npl");
    const hrlRows = formatRows(hrlRes.data || [], "hrl");

    // 4. Hydrate Player Names & Masking
    const idsSet = new Set<string>();
    [...nplRows.slice(0, 50), ...hrlRows.slice(0, 50)].forEach((r: any) => idsSet.add(String(r.player_id)));
    (trendingRes.data || []).forEach((r: any) => idsSet.add(String(r.player_id)));
    (gainersRes.data || []).forEach((r: any) => idsSet.add(String(r.player_id)));

    const { data: players } = await supabase.from("players").select("id, display_name, forename, surname").in("id", Array.from(idsSet));
    const playersMap = new Map(players?.map(p => [String(p.id), p]));
    const { data: consents } = await supabase.from("results").select("player_id, gdpr_flag").in("player_id", Array.from(idsSet)).eq("is_deleted", false);
    const consentMap = new Map();
    consents?.forEach(c => { if(c.gdpr_flag) consentMap.set(String(c.player_id), true); });

    const maskById = (pid: string, fallback: string) => {
      const p = playersMap.get(pid);
      const full = fullNameFrom(p, fallback);
      return consentMap.get(pid) ? full : toInitials(full);
    };

    return NextResponse.json({
      ok: true,
      leagues: [{ slug: "npl", label: "National Poker League" }, { slug: "hrl", label: "High Roller League" }],
      leaderboards: {
        npl: nplRows.map(r => ({ ...r, display_name: maskById(String(r.player_id), r.display_name), movement: r.movement })),
        hrl: hrlRows.map(r => ({ ...r, display_name: maskById(String(r.player_id), r.display_name), movement: r.movement }))
      },
      trending_players: (trendingRes.data || []).map((r: any) => ({ ...r, display_name: maskById(String(r.player_id), r.display_name) })),
      biggest_gainers: (gainersRes.data || []).map((r: any) => ({ ...r, display_name: maskById(String(r.player_id), r.display_name) })),
      season_meta: season
    });
  } catch (e: any) {
    return bad(500, e.message);
  }
}