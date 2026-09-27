import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { displayName } from "@/lib/nameMask";

export type CareerResult = {
  id: number;
  event_id: number;
  event_name: string;
  date: string | null;
  casino: string | null;
  high_roller: boolean;
  series_id: number | null;
  festival_id: string | null;
  season_id: number | null;
  position: number | null;
  points: number; // including any penalty
  prize: number;
};

export type SeasonLine = {
  season_id: number;
  name: string;
  year: number;
  active: boolean;
  leagues: Record<string, { position: number; points: number } | undefined>; // npl / hrl / lrl
  cashes: number;
  wins: number;
  final_tables: number;
  money: number;
  points: number;
};

export type Career = Awaited<ReturnType<typeof getCareer>>;

/** A player's whole career: every result (newest first), totals and season-by-season lines. */
async function loadCareer(playerId: number) {
  if (!Number.isFinite(playerId)) return null;
  const supabase = await createSupabaseServerClient();

  const [{ data: player }, { data: rows }, { data: seasons }, { data: snapshots }] = await Promise.all([
    supabase.from("players").select("id, forename, surname, display_name, avatar_url, gdpr, badge_count").eq("id", playerId).maybeSingle(),
    supabase
      .from("results")
      .select("id, finish_position, points, penalty_points, prize_amount, season_id, event:events(id, tournament_name, start_date, casino, is_high_roller, series_id, festival_id)")
      .eq("player_id", playerId)
      .eq("is_deleted", false),
    supabase.from("seasons").select("id, name, year, is_active").order("year", { ascending: false }),
    // Final (latest) league position per season comes from the snapshots taken at each import.
    supabase
      .from("leaderboard_positions")
      .select("league, season_id, position, points, snapshot_date")
      .eq("player_id", playerId)
      .order("snapshot_date", { ascending: false }),
  ]);
  if (!player) return null;

  const results: CareerResult[] = ((rows || []) as any[])
    .filter((r) => r.event)
    .map((r) => ({
      id: r.id,
      event_id: r.event.id,
      event_name: r.event.tournament_name ?? "Event",
      date: r.event.start_date,
      casino: r.event.casino,
      high_roller: !!r.event.is_high_roller,
      series_id: r.event.series_id ?? null,
      festival_id: r.event.festival_id ?? null,
      season_id: r.season_id,
      position: r.finish_position,
      points: Number(r.points || 0) + Number(r.penalty_points || 0),
      prize: Number(r.prize_amount || 0),
    }))
    .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));

  const sum = (list: CareerResult[]) => ({
    cashes: list.length,
    wins: list.filter((r) => r.position === 1).length,
    final_tables: list.filter((r) => r.position != null && r.position <= 9).length,
    money: list.reduce((n, r) => n + r.prize, 0),
    points: list.reduce((n, r) => n + r.points, 0),
  });

  const totals = {
    ...sum(results),
    best_cash: results.reduce<CareerResult | null>((best, r) => (r.prize > (best?.prize ?? 0) ? r : best), null),
    best_finish: results.reduce<number | null>((best, r) => (r.position != null && (best == null || r.position < best) ? r.position : best), null),
    badges: player.badge_count ?? 0,
  };

  const latestSnap = new Map<string, { position: number; points: number }>();
  for (const s of (snapshots || []) as any[]) {
    const k = `${s.season_id}:${s.league}`;
    if (!latestSnap.has(k)) latestSnap.set(k, { position: s.position, points: Number(s.points) });
  }

  const seasonLines: SeasonLine[] = ((seasons || []) as any[])
    .map((s) => {
      const list = results.filter((r) => r.season_id === s.id);
      return {
        season_id: s.id,
        name: s.name,
        year: s.year,
        active: !!s.is_active,
        leagues: {
          npl: latestSnap.get(`${s.id}:npl`),
          hrl: latestSnap.get(`${s.id}:hrl`),
          lrl: latestSnap.get(`${s.id}:lrl`),
        },
        ...sum(list),
      };
    })
    .filter((s) => s.cashes > 0);

  return {
    player: {
      id: player.id as number,
      name: displayName(player.forename, player.surname, !!player.gdpr, player.display_name),
      avatar_url: player.avatar_url as string | null,
      consent: !!player.gdpr,
    },
    results,
    totals,
    seasons: seasonLines,
  };
}

/** Events both players cashed in, with who finished higher. */
export function headToHead(a: CareerResult[], b: CareerResult[]) {
  const bByEvent = new Map(b.map((r) => [r.event_id, r]));
  const shared = a
    .filter((r) => bByEvent.has(r.event_id))
    .map((r) => ({ a: r, b: bByEvent.get(r.event_id)! }));
  const aAhead = shared.filter((s) => (s.a.position ?? Infinity) < (s.b.position ?? Infinity)).length;
  const bAhead = shared.filter((s) => (s.b.position ?? Infinity) < (s.a.position ?? Infinity)).length;
  return { shared, aAhead, bAhead };
}

/** Cached per request, so a page and its metadata share one load. */
export const getCareer = cache(loadCareer);
