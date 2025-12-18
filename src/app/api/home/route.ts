// src/app/api/home/route.ts
import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const revalidate = 0;

// FIX 1: Updated Type to match actual DB table (no method/cap_x)
type Season = {
  id: number;
  label: string;
  start_date: string;
  end_date: string;
  is_active: boolean | null;
};

function bad(code: number, msg: string, extra?: any) {
  return NextResponse.json({ ok: false, error: msg, extra }, { status: code });
}

/* --------- GDPR helpers (global rule) --------- */
function toInitials(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Anonymous";
  if (parts.length === 1) {
    const p = parts[0]!;
    return p[0] ? `${p[0].toUpperCase()}.` : "A.";
  }
  const first = parts[0]?.[0]?.toUpperCase() ?? "";
  const last = parts[parts.length - 1]?.[0]?.toUpperCase() ?? "";
  return `${first}. ${last}.`;
}
function fullNameFrom(player?: { display_name?: string | null; forename?: string | null; surname?: string | null }, fallback: string = "") {
  const dn = (player?.display_name || "").trim();
  if (dn) return dn;
  const composed = [player?.forename, player?.surname].filter(Boolean).join(" ").trim();
  if (composed) return composed;
  return fallback || "Anonymous";
}
function gdprMaskName(hasConsent: boolean | undefined | null, fullName: string) {
  return hasConsent ? fullName : toInitials(fullName);
}

export async function GET() {
  try {
    const supabase = await createSupabaseRouteClient();

    // ----- Season range -----
    let season: Season | null = null;
    let from: string;
    let to: string;

    // FIX 2: Removed 'method' and 'cap_x' from select to avoid query error
    const { data: seasonRow, error: seasonErr } = await supabase
      .from("seasons")
      .select("id,label,start_date,end_date,is_active")
      .eq("is_active", true)
      .maybeSingle();

    if (!seasonErr && seasonRow) {
      season = seasonRow as Season;
      from = (season.start_date || "").slice(0, 10);
      to = (season.end_date || "").slice(0, 10);
    } else {
      const today = new Date();
      const prior = new Date(today);
      prior.setDate(today.getDate() - 365);
      from = prior.toISOString().slice(0, 10);
      to = today.toISOString().slice(0, 10);
      season = {
        id: 0,
        label: "Last 12 months",
        start_date: from,
        end_date: to,
        is_active: false,
      };
    }

    // FIX 3: Defaults since DB cols are missing
    const method = "ALL";
    const cap = 0;

    // ----- Leaderboards (Top 10) -----
    const { data: nplRows, error: nplErr } = await supabase.rpc("leaderboard_season", {
      p_from: from,
      p_to: to,
      p_league: "npl",
      p_method: method,
      p_cap: cap,
      p_search: undefined, // FIX 4: Changed null to undefined
      p_limit: 10,
      p_offset: 0,
    });
    if (nplErr) return bad(500, "leaderboard_season (npl) failed", { rpc: nplErr.message });

    const { data: hrlRows, error: hrlErr } = await supabase.rpc("leaderboard_season", {
      p_from: from,
      p_to: to,
      p_league: "hrl",
      p_method: "ALL",
      p_cap: 0,
      p_search: undefined, // FIX 4: Changed null to undefined
      p_limit: 10,
      p_offset: 0,
    });
    if (hrlErr) return bad(500, "leaderboard_season (hrl) failed", { rpc: hrlErr.message });

    // ----- Upcoming events (public) -----
    const today = new Date().toISOString().slice(0, 10);
    const { data: upcoming, error: upErr } = await supabase
      .from("events")
      .select("id,name,start_date,festival_id,series_id")
      .eq("is_deleted", false)
      .gte("start_date", today)
      .order("start_date", { ascending: true })
      .limit(12);
    if (upErr) return bad(500, "Events fetch failed", { err: upErr.message });

    // ----- Trending Players (last 30 days) -----
    let trending: Array<{ player_id: string; hits: number; display_name: string }> = [];
    {
      // FIX 5: Removed empty object arg '{}' which caused type mismatch
      const { data, error } = await supabase.rpc("rpc_trending_players_last30");
      if (!error && Array.isArray(data)) trending = data as any;
    }

    // ----- Biggest Gainers (since last weekly snapshot) -----
    let gainers: Array<{ player_id: string; display_name: string; from_pos: number; to_pos: number; delta: number }> = [];
    {
      const { data, error } = await supabase.rpc("rpc_biggest_gainers_week", { p_league: "npl" });
      if (!error && Array.isArray(data)) {
        gainers = data as any;
      } else {
        // Fallback: compute from two most recent snapshots
        const recent = await supabase
          .from("leaderboard_positions")
          .select("snapshot_date")
          .eq("league", "npl")
          .order("snapshot_date", { ascending: false })
          .limit(2);

        if (!recent.error && recent.data?.length === 2) {
          const [d0, d1] = recent.data.map((r: any) => r.snapshot_date).sort(); // asc
          const prior = d0;
          const latest = d1;

          const [curSnap, prevSnap] = await Promise.all([
            supabase
              .from("leaderboard_positions")
              .select("player_id, position")
              .eq("league", "npl")
              .eq("snapshot_date", latest),
            supabase
              .from("leaderboard_positions")
              .select("player_id, position")
              .eq("league", "npl")
              .eq("snapshot_date", prior),
          ]);

          if (!curSnap.error && !prevSnap.error && Array.isArray(curSnap.data) && Array.isArray(prevSnap.data)) {
            const prevMap = new Map<string, number>(prevSnap.data.map((r: any) => [String(r.player_id), Number(r.position)]));
            const changes = curSnap.data
              .map((r: any) => {
                const fromPos = prevMap.get(String(r.player_id));
                if (!fromPos) return null;
                const toPos = Number(r.position);
                const delta = fromPos - toPos; // positive = improved
                return { player_id: String(r.player_id), from_pos: fromPos, to_pos: toPos, delta };
              })
              .filter(Boolean) as Array<{ player_id: string; from_pos: number; to_pos: number; delta: number }>;

            changes.sort((a, b) => b.delta - a.delta);
            const top = changes.slice(0, 10);

            gainers = top.map((g) => ({
              player_id: g.player_id,
              display_name: g.player_id, // placeholder, we'll hydrate + GDPR later
              from_pos: g.from_pos,
              to_pos: g.to_pos,
              delta: g.delta,
            }));
          }
        }
      }
    }

    // ----- Latest Results (winners only, newest by event date) -----
    type LatestWinnerRow = {
      id: string;
      event_id: string | null;
      result_date: string | null;
      event_name: string | null;
      winner_name: string;
      prize_amount: number | null;
      _sort_key?: string;
      _player_id?: string;
    };
    let latestResults: LatestWinnerRow[] = [];
    let latestResultsPlayerIds: string[] = [];
    {
      const { data, error } = await supabase
        .from("results")
        .select("id, player_id, tournament_name, prize_amount, position_of_prize, created_at, event_id, gdpr_flag")
        .eq("is_deleted", false)
        .eq("position_of_prize", 1)
        .order("created_at", { ascending: false })
        .limit(300);

      if (!error && Array.isArray(data) && data.length) {
        type EventRow = { id: string | number; name: string | null; start_date: string | null };
        const eventIds = Array.from(new Set(data.map((r: any) => r.event_id).filter(Boolean)));
        let events: EventRow[] = [];
        if (eventIds.length) {
          const evRes = await supabase.from("events").select("id, name, start_date").in("id", eventIds);
          if (!evRes.error && Array.isArray(evRes.data)) events = evRes.data as any as EventRow[];
        }
        const eventMap = new Map<string, EventRow>(events.map((e) => [String(e.id), e]));

        const playerIds = Array.from(new Set(data.map((r: any) => String(r.player_id))));
        latestResultsPlayerIds = playerIds.slice();

        const { data: players } = await supabase
          .from("players")
          .select("id, display_name, forename, surname")
          .in("id", playerIds);
        const playerMap = new Map<
          string,
          { id: string; display_name: string | null; forename: string | null; surname: string | null }
        >((players || []).map((p: any) => [String(p.id), p]));

        const enriched = data.map((r: any) => {
          const p = playerMap.get(String(r.player_id));
          const ev = r.event_id ? eventMap.get(String(r.event_id)) : undefined;

          const full = fullNameFrom(p, String(r.player_id));
          const sortKey = (ev?.start_date ?? r.created_at) || "1970-01-01";

          return {
            id: String(r.id),
            event_id: r.event_id ? String(r.event_id) : null,
            result_date: (ev?.start_date ?? r.created_at)?.slice(0, 10) ?? null,
            event_name: r.tournament_name ?? ev?.name ?? null,
            winner_name: full,
            prize_amount: r.prize_amount ?? null,
            _sort_key: sortKey,
            _player_id: String(r.player_id),
          } satisfies LatestWinnerRow;
        });

        enriched.sort((a, b) => (a._sort_key! < b._sort_key! ? 1 : a._sort_key! > b._sort_key! ? -1 : 0));
        latestResults = enriched.slice(0, 12);
      }
    }

    // --------- GLOBAL GDPR: collect IDs from all sections ---------
    const idsSet = new Set<string>();
    (nplRows ?? []).forEach((r: any) => idsSet.add(String(r.player_id)));
    (hrlRows ?? []).forEach((r: any) => idsSet.add(String(r.player_id)));
    (trending ?? []).forEach((r: any) => idsSet.add(String(r.player_id)));
    (gainers ?? []).forEach((r: any) => idsSet.add(String(r.player_id)));
    latestResultsPlayerIds.forEach((id) => idsSet.add(String(id)));

    const allIds = Array.from(idsSet);
    let playersMap = new Map<string, { id: string; display_name: string | null; forename: string | null; surname: string | null }>();
    let consentMap = new Map<string, boolean>(); 

    if (allIds.length) {
      const { data: players } = await supabase
        .from("players")
        .select("id, display_name, forename, surname")
        .in("id", allIds);
      if (Array.isArray(players)) {
        playersMap = new Map(players.map((p: any) => [String(p.id), p]));
      }

      const { data: consents } = await supabase
        .from("results")
        .select("player_id, gdpr_flag")
        .in("player_id", allIds)
        .eq("is_deleted", false);
      if (Array.isArray(consents)) {
        const tmp = new Map<string, boolean>();
        for (const row of consents as any[]) {
          const pid = String(row.player_id);
          if (row.gdpr_flag === true) tmp.set(pid, true);
          else if (!tmp.has(pid)) tmp.set(pid, false);
        }
        consentMap = tmp;
      }
    }

    const maskById = (pid: string, existingName: string) => {
      const hasConsent = consentMap.get(pid) === true;
      const p = playersMap.get(pid);
      const full = fullNameFrom(p, existingName || pid);
      return gdprMaskName(hasConsent, full);
    };

    const nplMasked = (nplRows ?? []).map((r: any) => ({
      ...r,
      display_name: maskById(String(r.player_id), r.display_name || String(r.player_id)),
    }));
    const hrlMasked = (hrlRows ?? []).map((r: any) => ({
      ...r,
      display_name: maskById(String(r.player_id), r.display_name || String(r.player_id)),
    }));

    const trendingMasked = (trending ?? []).map((t) => ({
      ...t,
      display_name: maskById(String(t.player_id), t.display_name || String(t.player_id)),
    }));

    if (gainers?.length) {
      gainers = gainers.map((g) => {
        const pid = String(g.player_id);
        const masked = maskById(pid, g.display_name || pid);
        return { ...g, display_name: masked };
      });
    }

    latestResults = latestResults.map((row) => {
      const pid = row._player_id ? String(row._player_id) : "";
      const masked = pid ? maskById(pid, row.winner_name) : row.winner_name;
      const { _player_id, _sort_key, ...rest } = row;
      return { ...rest, winner_name: masked };
    });

    // --------- Response ---------
    return NextResponse.json({
      ok: true,
      season_meta: {
        id: season!.id,
        label: season!.label,
        start_date: from,
        end_date: to,
        method: method, // Use default
        cap_x: cap, // Use default
        is_active: !!season!.is_active,
      },
      leaderboards: { npl: nplMasked, hrl: hrlMasked },
      upcoming_events: upcoming ?? [],
      trending_players: trendingMasked ?? [],
      biggest_gainers: gainers ?? [],
      latest_results: latestResults ?? [],
    });
  } catch (e: any) {
    return bad(500, e?.message || "Unexpected error");
  }
}