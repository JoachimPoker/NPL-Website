import { createSupabasePublicClient } from "@/lib/supabasePublic";
import { displayName } from "@/lib/nameMask";

type Season = {
  id: number;
  label: string;
  start_date: string;
  end_date: string;
  method?: "ALL" | "BEST_X" | null;
  cap_x?: number | null;
  is_active: boolean | null;
};

/** Home page data: this season's league tables with movement and the biggest gainers. */
export async function getHomeData() {
  try {
    const supabase = createSupabasePublicClient();

    // 1. Get Active Season
    const { data: seasonRow } = await supabase.from("seasons").select("*, label:name").eq("is_active", true).maybeSingle();
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

    // Leagues running this season (NPL first, then HRL, LRL, then any others)
    const order = ["npl", "hrl", "lrl"];
    const { data: leagueRows } = await supabase.from("leagues").select("slug, label").eq("season_id", season.id);
    const rank = (s: string) => (order.indexOf(s) + 1) || order.length + 1;
    const { data: prizeRows } = await supabase.from("season_prizes").select("position_to").eq("season_id", season.id).eq("league", "npl");
    const prizePlaces = prizeRows?.length ? Math.max(...prizeRows.map((p) => p.position_to)) : null;
    const { data: brandRows } = await supabase.from("league_brands").select("slug, logo_url");
    const logoBySlug = new Map((brandRows || []).map((b) => [b.slug, b.logo_url]));
    const leagues = (leagueRows?.length ? leagueRows : [{ slug: "npl", label: "National Poker League" }, { slug: "hrl", label: "High Roller League" }])
      .sort((a, b) => rank(a.slug) - rank(b.slug))
      .map((l) => ({ ...l, logo_url: logoBySlug.get(l.slug) ?? null }));

    // 2. Fetch Data (Removed datesRes from here to do it manually below)
    // Every league running this season. Scoring rules come from the leagues table inside
    // leaderboard_season; method/cap here are only the season-level fallback.
    const [leagueResults, gainersRes] = await Promise.all([
      Promise.all(
        leagues.map((l) =>
          supabase.rpc("leaderboard_season", {
            p_from: from, p_to: to, p_league: l.slug,
            p_method: l.slug === "npl" ? season.method ?? "ALL" : "ALL",
            p_cap: l.slug === "npl" ? season.cap_x ?? 0 : 0,
          })
        )
      ),
      supabase.rpc("rpc_biggest_gainers_week", { p_league: "npl" })
    ]);
    const resultsBySlug = new Map(leagues.map((l, i) => [l.slug, leagueResults[i].data || []]));

    // 3. Movement Logic: Smart Date Fetching
    // Step A: Get the absolute latest date
    const { data: latestRows } = await supabase
      .from("leaderboard_positions")
      .select("snapshot_date")
      .eq("season_id", season.id)
      .order("snapshot_date", { ascending: false })
      .limit(1);
    
    const latestDate = latestRows?.[0]?.snapshot_date;

    // Step B: Get the first date OLDER than the latest date (The "Previous" Snapshot)
    let previousDate = undefined;
    if (latestDate) {
      const { data: prevRows } = await supabase
        .from("leaderboard_positions")
        .select("snapshot_date")
        .eq("season_id", season.id)
        .lt("snapshot_date", latestDate) // Less than latest
        .order("snapshot_date", { ascending: false })
        .limit(1);
      previousDate = prevRows?.[0]?.snapshot_date;
    }

    const movementMap = new Map<string, number>();

    if (latestDate) {
      // Step C: Limit lookup to Top 50 to respect Supabase limits
      const activeIds = [...resultsBySlug.values()].flatMap((rows) => rows.slice(0, 50)).map((r) => Number(r.player_id));
      
      const { data: posData } = await supabase
        .from("leaderboard_positions")
        .select("player_id, position, snapshot_date, league")
        .eq("season_id", season.id)
        .in("snapshot_date", [latestDate, previousDate].filter((d): d is string => !!d))
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

    const rowsBySlug = new Map([...resultsBySlug].map(([slug, rows]) => [slug, formatRows(rows, slug)]));

    // 4. Hydrate Player Names & Masking
    const idsSet = new Set<string>();
    [...rowsBySlug.values()].flatMap((rows) => rows.slice(0, 50)).forEach((r: any) => idsSet.add(String(r.player_id)));
    (gainersRes.data || []).forEach((r: any) => idsSet.add(String(r.player_id)));

    const { data: players } = await supabase.from("players").select("id, display_name, forename, surname, gdpr").in("id", Array.from(idsSet).map(Number));
    const playersMap = new Map(players?.map(p => [String(p.id), p]));
    const consentMap = new Map<string, boolean>();
    players?.forEach(p => { if (p.gdpr) consentMap.set(String(p.id), true); });

    // Same masking as everywhere else (initials without GDPR consent; "Unknown player" for junk names).
    const maskById = (pid: string, fallback: string) => {
      const p = playersMap.get(pid);
      return p ? displayName(p.forename, p.surname, !!consentMap.get(pid), p.display_name) : fallback;
    };

    return {
      ok: true as const,
      leagues,
      leaderboards: Object.fromEntries(
        [...rowsBySlug].map(([slug, rows]) => [
          slug,
          rows.map((r) => ({ ...r, display_name: maskById(String(r.player_id), r.display_name), movement: r.movement })),
        ])
      ),
      biggest_gainers: (gainersRes.data || []).map((r: any) => ({ ...r, display_name: maskById(String(r.player_id), r.display_name), is_anonymized: !consentMap.get(String(r.player_id)) })),
      // Last paid place in the main league (null when no prizes are set: the site uses the top 10).
      prize_places: prizePlaces,
      season_meta: season
    };
  } catch (e: any) {
    return {
      ok: false as const,
      error: e?.message as string,
      leagues: [],
      leaderboards: { npl: [], hrl: [] },
      biggest_gainers: [],
    };
  }
}
