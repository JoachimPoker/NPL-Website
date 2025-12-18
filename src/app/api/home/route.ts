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
  return NextResponse.json({ ok: false, error: msg, extra }, { status: code });
}

/* --------- GDPR helpers --------- */
function toInitials(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Anonymous";
  if (parts.length === 1) return `${parts[0]![0]?.toUpperCase() ?? "A"}.`;
  const first = parts[0]?.[0]?.toUpperCase() ?? "";
  const last = parts[parts.length - 1]?.[0]?.toUpperCase() ?? "";
  return `${first}. ${last}.`;
}

function fullNameFrom(player?: any, fallback: string = "") {
  const dn = (player?.display_name || "").trim();
  if (dn) return dn;
  const composed = [player?.forename, player?.surname].filter(Boolean).join(" ").trim();
  return composed || fallback || "Anonymous";
}

export async function GET() {
  try {
    const supabase = await createSupabaseRouteClient();

    // 1. Get Active Season
    const { data: seasonRow } = await supabase
      .from("seasons")
      .select("id, label, start_date, end_date, is_active") 
      .eq("is_active", true)
      .maybeSingle();

    const season = (seasonRow as unknown as Season) || {
      id: 0,
      label: "Last 12 months",
      start_date: new Date(Date.now() - 31536000000).toISOString(),
      end_date: new Date().toISOString(),
      method: "ALL",
      cap_x: 0,
      is_active: false
    };

    const from = season.start_date.slice(0, 10);
    const to = season.end_date.slice(0, 10);

    // 2. Fetch Data
    const [nplRes, hrlRes, trendingRes, gainersRes, datesRes] = await Promise.all([
      supabase.rpc("leaderboard_season", { p_from: from, p_to: to, p_league: "npl", p_method: season.method ?? "ALL", p_cap: season.cap_x ?? 0 }),
      supabase.rpc("leaderboard_season", { p_from: from, p_to: to, p_league: "hrl", p_method: "ALL", p_cap: 0 }),
      supabase.rpc("rpc_trending_players_last30"),
      supabase.rpc("rpc_biggest_gainers_week", { p_league: "npl" }),
      supabase.from("leaderboard_positions").select("snapshot_date").order("snapshot_date", { ascending: false }).limit(20)
    ]);

    // 3. Movement Logic: Targeted Comparison with Debugging
    const uniqueDates = Array.from(new Set(datesRes.data?.map(d => d.snapshot_date) || []));
    const latestSnapshotDate = uniqueDates[0];

    console.log("--- MOVEMENT DEBUG START ---");
    console.log("Snapshot Date Found:", latestSnapshotDate);

    let movementMap = new Map<string, number>();

    if (latestSnapshotDate) {
      // Create list of IDs currently on the leaderboard
      const nplIds = (nplRes.data || []).map(r => String(r.player_id));
      const hrlIds = (hrlRes.data || []).map(r => String(r.player_id));
      const relevantIds = Array.from(new Set([...nplIds, ...hrlIds]));

      console.log(`Searching for ${relevantIds.length} players in snapshot...`);

      const { data: snapData, error: snapErr } = await supabase
        .from("leaderboard_positions")
        .select("player_id, position, league")
        .eq("snapshot_date", latestSnapshotDate)
        .in("player_id", relevantIds);

      if (snapErr) console.error("Snapshot Fetch Error:", snapErr);

      snapData?.forEach(s => {
        movementMap.set(`${s.league}-${String(s.player_id)}`, s.position);
      });
      
      console.log(`Successfully mapped ${snapData?.length || 0} positions from snapshot.`);
    }

    const formatRows = (rows: any[], league: string) => {
      return (rows || []).map((r: any, idx: number) => {
        const snapPos = movementMap.get(`${league}-${String(r.player_id)}`);
        const movement = snapPos ? (snapPos - r.position) : 0;

        // Log the first player of each league to verify math
        if (idx === 0) {
          console.log(`[${league}] Top Player: ${r.display_name} | ID: ${r.player_id} | Live: ${r.position} | Snap: ${snapPos ?? 'N/A'} | Move: ${movement}`);
        }

        return {
          ...r,
          events_played: r.total_count || r.events_played || 0,
          top9_count: r.top9_count || 0,
          wins: r.wins || 0,
          movement: movement 
        };
      });
    };

    const nplRowsPreMask = formatRows(nplRes.data || [], "npl");
    const hrlRowsPreMask = formatRows(hrlRes.data || [], "hrl");

    // 4. GDPR Masking
    const trendingRows = trendingRes.data || [];
    const gainersRows = gainersRes.data || [];

    const idsSet = new Set<string>();
    [...nplRowsPreMask, ...hrlRowsPreMask, ...trendingRows, ...gainersRows].forEach((r: any) => idsSet.add(String(r.player_id)));
    
    const { data: players } = await supabase.from("players").select("*").in("id", Array.from(idsSet));
    const playersMap = new Map(players?.map(p => [String(p.id), p]));

    const { data: consents } = await supabase.from("results")
      .select("player_id, gdpr_flag")
      .in("player_id", Array.from(idsSet))
      .eq("is_deleted", false);

    const consentMap = new Map();
    consents?.forEach(c => { if(c.gdpr_flag) consentMap.set(String(c.player_id), true); });

    const mask = (r: any) => {
      const pid = String(r.player_id);
      const full = fullNameFrom(playersMap.get(pid), r.display_name);
      return consentMap.get(pid) ? full : toInitials(full);
    };

    console.log("--- MOVEMENT DEBUG END ---");

// 5. Final Assembly - EXPLICITLY pass movement in the final map
    return NextResponse.json({
      ok: true,
      season_meta: { ...season, start_date: from, end_date: to },
      leagues: [{ slug: "npl", label: "National Poker League" }, { slug: "hrl", label: "High Roller League" }],
      leaderboards: {
        npl: nplRowsPreMask.map((r: any) => ({ 
          ...r, 
          display_name: mask(r), 
          movement: r.movement // <-- ENSURE THIS IS HERE
        })),
        hrl: hrlRowsPreMask.map((r: any) => ({ 
          ...r, 
          display_name: mask(r), 
          movement: r.movement // <-- ENSURE THIS IS HERE
        })),
      },
      trending_players: trendingRows.map((r: any) => ({ ...r, display_name: mask(r) })),
      biggest_gainers: gainersRows.map((r: any) => ({ ...r, display_name: mask(r) })),
      latest_results: []
    });

  } catch (e: any) {
    console.error("HOME API ERROR:", e.message);
    return bad(500, e.message);
  }
}