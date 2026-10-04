import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { baseKey, type BadgeDefinition } from "@/lib/badges";

export const PAGE_SIZE = 50;
export type LeagueSlug = "npl" | "hrl" | "lrl";
export type AllTimeSort = "points" | "money" | "wins" | "cashes" | "final_tables" | "seasons";

export type SeasonInfo = { id: number; name: string; year: number; is_active: boolean };
export type LeagueInfo = {
  id: number;
  slug: LeagueSlug;
  label: string;
  scoring_method: string | null;
  scoring_cap: number | null;
  extra_per_result: number;
  high_roller_only: boolean;
  max_buy_in: number | null;
  logo_url: string | null;
};
/** A title a player holds, shown as an icon next to their name. */
/** A title a player holds, with its definition so it can be drawn as its seal. */
export type TitleIcon = { key: string; name: string; icon: string | null; count: number; def: BadgeDefinition };

export type BoardRow = {
  player_id: number;
  display_name: string;
  position: number;
  points: number;
  cashes: number;
  counted: number | null; // season boards: results that count
  wins: number;
  final_tables: number;
  money: number | null; // all-time only
  seasons: number | null; // all-time only
  movement: number | null; // current season only: places up (+) or down (-) since the last import
  titles: TitleIcon[];
};
export type Prize = { position_from: number; position_to: number; prize_description: string; prize_amount: number | null };

type Db = Awaited<ReturnType<typeof createSupabaseServerClient>>;

const LEAGUE_ORDER: Record<string, number> = { npl: 0, hrl: 1, lrl: 2 };

export async function getSeasons(db: Db): Promise<SeasonInfo[]> {
  const { data } = await db.from("seasons").select("id, name, year, is_active").order("year", { ascending: false });
  return ((data || []) as any[]).map((s) => ({ id: s.id, name: s.name, year: s.year, is_active: !!s.is_active }));
}

/** Leagues running in a season, with their rules and logos. */
export async function getLeagues(db: Db, seasonId: number | null): Promise<LeagueInfo[]> {
  const [{ data: rows }, { data: brands }] = await Promise.all([
    seasonId
      ? db
          .from("leagues")
          .select("id, slug, label, scoring_method, scoring_cap, filter_is_high_roller, max_buy_in, league_bonuses(bonus_type, points_value)")
          .eq("season_id", seasonId)
      : Promise.resolve({ data: [] as any[] }),
    db.from("league_brands").select("slug, name, logo_url"),
  ]);
  const logo = new Map((brands || []).map((b) => [b.slug, b.logo_url]));
  if (!seasonId) {
    // All-time: every league that has a brand (NPL, HRL, LRL).
    return ((brands || []) as any[])
      .map((b) => ({
        id: 0, slug: b.slug, label: b.name, scoring_method: null, scoring_cap: null, extra_per_result: 0,
        high_roller_only: b.slug === "hrl", max_buy_in: b.slug === "lrl" ? 300 : null, logo_url: b.logo_url,
      }))
      .sort((a, b) => (LEAGUE_ORDER[a.slug] ?? 9) - (LEAGUE_ORDER[b.slug] ?? 9));
  }
  return ((rows || []) as any[])
    .map((l) => ({
      id: l.id,
      slug: l.slug,
      label: l.label,
      scoring_method: l.scoring_method,
      scoring_cap: l.scoring_cap,
      extra_per_result: ((l.league_bonuses as any[]) || [])
        .filter((b) => b.bonus_type === "participation_after_cap")
        .reduce((n, b) => n + Number(b.points_value || 0), 0),
      high_roller_only: !!l.filter_is_high_roller,
      max_buy_in: l.max_buy_in,
      logo_url: logo.get(l.slug) ?? null,
    }))
    .sort((a, b) => (LEAGUE_ORDER[a.slug] ?? 9) - (LEAGUE_ORDER[b.slug] ?? 9));
}

/** "Best 20 results count · +2 pts for each result after that". */
export function formatRules(l: LeagueInfo | null, allTime = false, firstYear?: number) {
  if (!l) return null;
  if (allTime) {
    const scope = l.slug === "hrl" ? "High Roller events" : l.slug === "lrl" ? "events up to £300" : "every event";
    return `${firstYear ? `Every result since ${firstYear}` : "Every result"} counts · ${scope}`;
  }
  const parts = [l.scoring_method === "capped" && l.scoring_cap ? `Best ${l.scoring_cap} results count` : "Every result counts"];
  if (l.scoring_method === "capped" && l.extra_per_result) parts.push(`+${l.extra_per_result} pts for each result after that`);
  if (l.high_roller_only) parts.push("High Roller events only");
  if (l.max_buy_in) parts.push(`buy-ins up to £${Number(l.max_buy_in).toLocaleString("en-GB")}`);
  return parts.join(" · ");
}

/** One page of a season table (league rules applied in the database), plus the total. */
export async function seasonBoard(db: Db, leagueId: number, page: number, search: string | null) {
  const from = (page - 1) * PAGE_SIZE;
  const args = { p_league_id: leagueId, ...(search ? { p_search: search } : {}) };
  const [{ data, error }, { count }] = await Promise.all([
    db.rpc("league_standings", args).order("position").range(from, from + PAGE_SIZE - 1),
    db.rpc("league_standings", args, { count: "exact", head: true }),
  ]);
  if (error) throw new Error(error.message);
  const rows: BoardRow[] = ((data || []) as any[]).map((r) => ({
    player_id: r.player_id,
    display_name: r.display_name,
    position: Number(r.position),
    points: Number(r.total_points),
    cashes: Number(r.total_count),
    counted: Number(r.used_count),
    wins: Number(r.wins),
    final_tables: Number(r.top9_count),
    money: null,
    seasons: null,
    movement: null,
    titles: [],
  }));
  return { rows, total: count ?? rows.length };
}

/** One page of the all-time table, plus the total. */
export async function allTimeBoard(db: Db, league: LeagueSlug, sort: AllTimeSort, page: number, search: string | null) {
  const from = (page - 1) * PAGE_SIZE;
  const args = { p_league: league, p_sort: sort, ...(search ? { p_search: search } : {}) };
  const [{ data, error }, { count }] = await Promise.all([
    db.rpc("leaderboard_all_time", args).order("position").range(from, from + PAGE_SIZE - 1),
    db.rpc("leaderboard_all_time", args, { count: "exact", head: true }),
  ]);
  if (error) throw new Error(error.message);
  const rows: BoardRow[] = ((data || []) as any[]).map((r) => ({
    player_id: r.player_id,
    display_name: r.display_name,
    position: Number(r.position),
    points: Number(r.total_points),
    cashes: Number(r.cashes),
    counted: null,
    wins: Number(r.wins),
    final_tables: Number(r.final_tables),
    money: Number(r.money),
    seasons: Number(r.seasons),
    movement: null,
    titles: [],
  }));
  return { rows, total: count ?? rows.length };
}

/**
 * Titles (badges) held by these players, as icons for the table. With a season year, only
 * titles won that season; without one (all-time), every title. Only badge keys are fetched,
 * so achievements can't crowd titles out of the 1,000-row API limit.
 */
export async function titlesFor(db: Db, playerIds: number[], seasonYear: number | null) {
  const out = new Map<number, TitleIcon[]>();
  if (!playerIds.length) return out;
  const { data: defs } = await db
    .from("badge_definitions")
    .select("*")
    .eq("kind", "badge")
    .eq("is_active", true);
  if (!defs?.length) return out;
  const defByKey = new Map((defs as BadgeDefinition[]).map((d) => [d.key, d]));

  let query = db
    .from("player_badges")
    .select("player_id, badge_key")
    .in("player_id", playerIds)
    .or(defs.map((d) => `badge_key.eq.${d.key},badge_key.like.${d.key}@*`).join(","));
  if (seasonYear) query = query.eq("season_year", seasonYear);
  const { data: awards } = await query.limit(1000);

  const counts = new Map<number, Map<string, number>>();
  for (const a of awards || []) {
    const key = baseKey(a.badge_key);
    if (!defByKey.has(key) || !a.player_id) continue;
    const m = counts.get(a.player_id) ?? new Map<string, number>();
    m.set(key, (m.get(key) ?? 0) + 1);
    counts.set(a.player_id, m);
  }
  for (const [pid, m] of counts) {
    out.set(
      pid,
      [...m.entries()]
        .map(([key, count]) => ({ key, count, name: defByKey.get(key)!.name, icon: defByKey.get(key)!.icon, def: defByKey.get(key)! }))
        .sort((a, b) => (defByKey.get(a.key)!.display_order ?? 0) - (defByKey.get(b.key)!.display_order ?? 0))
    );
  }
  return out;
}

/**
 * Latest two import snapshots for a league this season. Each snapshot is dated by the last
 * tournament in that weekly report, so `latest` reads as "results up to <date>".
 */
export async function snapshots(db: Db, seasonId: number, league: LeagueSlug) {
  const { data: dates } = await db
    .from("leaderboard_positions")
    .select("snapshot_date")
    .eq("season_id", seasonId)
    .eq("league", league)
    .order("snapshot_date", { ascending: false })
    .limit(1);
  const latest = dates?.[0]?.snapshot_date;
  if (!latest) return null;
  const { data: prevRows } = await db
    .from("leaderboard_positions")
    .select("snapshot_date")
    .eq("season_id", seasonId)
    .eq("league", league)
    .lt("snapshot_date", latest)
    .order("snapshot_date", { ascending: false })
    .limit(1);
  const previous = prevRows?.[0]?.snapshot_date ?? null;
  return { latest, previous };
}

/** Places moved since the previous import, for the players on this page. */
export async function movementFor(db: Db, seasonId: number, league: LeagueSlug, playerIds: number[]) {
  const out = new Map<number, number>();
  const snap = await snapshots(db, seasonId, league);
  if (!snap?.previous || !playerIds.length) return out;
  const { data } = await db
    .from("leaderboard_positions")
    .select("player_id, position, snapshot_date")
    .eq("season_id", seasonId)
    .eq("league", league)
    .in("snapshot_date", [snap.latest, snap.previous])
    .in("player_id", playerIds);
  const prev = new Map<number, number>();
  const now = new Map<number, number>();
  for (const r of data || []) {
    if (!r.player_id) continue;
    (r.snapshot_date === snap.previous ? prev : now).set(r.player_id, r.position);
  }
  for (const [pid, pos] of now) if (prev.has(pid)) out.set(pid, prev.get(pid)! - pos);
  return out;
}

export type WeekItem = { label: string; player_id: number; name: string; detail: string };

/** "This week": biggest climber, newest top-10 entry, most points gained since the last import. */
export async function thisWeek(db: Db, seasonId: number, league: LeagueSlug, names: Map<number, string>): Promise<WeekItem[]> {
  const snap = await snapshots(db, seasonId, league);
  if (!snap?.previous) return [];
  const { data } = await db
    .from("leaderboard_positions")
    .select("player_id, position, points, snapshot_date")
    .eq("season_id", seasonId)
    .eq("league", league)
    .in("snapshot_date", [snap.latest, snap.previous])
    .lte("position", 500)
    .limit(1000);
  const prev = new Map<number, { position: number; points: number }>();
  const now = new Map<number, { position: number; points: number }>();
  for (const r of data || []) {
    if (!r.player_id) continue;
    (r.snapshot_date === snap.previous ? prev : now).set(r.player_id, { position: r.position, points: Number(r.points) });
  }
  const moves = [...now.entries()].map(([pid, n]) => ({
    pid,
    now: n,
    prev: prev.get(pid) ?? null,
    climb: prev.has(pid) ? prev.get(pid)!.position - n.position : 0,
    gained: n.points - (prev.get(pid)?.points ?? 0),
  }));
  const items: WeekItem[] = [];
  const climber = moves.filter((m) => m.now.position <= 100 && m.climb > 0).sort((a, b) => b.climb - a.climb)[0];
  if (climber) items.push({ label: "Biggest climber", player_id: climber.pid, name: "", detail: `Up ${climber.climb} ${climber.climb === 1 ? "place" : "places"} to #${climber.now.position}` });
  const newTop10 = moves
    .filter((m) => m.now.position <= 10 && (!m.prev || m.prev.position > 10))
    .sort((a, b) => a.now.position - b.now.position)[0];
  if (newTop10) items.push({ label: "New in the top 10", player_id: newTop10.pid, name: "", detail: `Now #${newTop10.now.position}` });
  const scorer = moves.filter((m) => m.gained > 0).sort((a, b) => b.gained - a.gained)[0];
  if (scorer) items.push({ label: "Most points", player_id: scorer.pid, name: "", detail: `+${scorer.gained.toFixed(2)} pts` });

  // Names come from the table where possible; otherwise look them up (masked like everywhere else).
  const missing = items.map((i) => i.player_id).filter((id) => !names.has(id));
  if (missing.length) {
    const { data: ps } = await db.from("players").select("id, forename, surname, display_name, gdpr").in("id", missing);
    const { displayName } = await import("@/lib/nameMask");
    for (const p of ps || []) names.set(p.id, displayName(p.forename, p.surname, !!p.gdpr, p.display_name));
  }
  return items.map((i) => ({ ...i, name: names.get(i.player_id) ?? "Unknown player" }));
}

export type RaceSeries = { dates: string[]; players: { id: number; name: string; points: number[] }[] };

/** Points building up through the season for the top players, using the league's rules. */
export async function seasonRace(db: Db, seasonId: number, league: LeagueInfo, top: { player_id: number; display_name: string }[]): Promise<RaceSeries> {
  if (!top.length) return { dates: [], players: [] };
  const { data } = await db
    .from("results")
    .select("player_id, points, penalty_points, event:events!inner(start_date, season_id, is_high_roller, buy_in, is_deleted)")
    .in("player_id", top.map((t) => t.player_id))
    .eq("is_deleted", false)
    .eq("event.season_id", seasonId)
    .eq("event.is_deleted", false)
    .limit(1000);
  const rows = ((data || []) as any[]).filter(
    (r) =>
      r.event?.start_date &&
      (!league.high_roller_only || r.event.is_high_roller) &&
      (league.max_buy_in == null || Number(r.event.buy_in ?? 0) <= Number(league.max_buy_in))
  );
  const dates = [...new Set(rows.map((r) => String(r.event.start_date).slice(0, 10)))].sort();
  const cap = league.scoring_method === "capped" ? league.scoring_cap : null;
  const players = top.map((t) => {
    const mine = rows
      .filter((r) => r.player_id === t.player_id)
      .map((r) => ({ d: String(r.event.start_date).slice(0, 10), p: Number(r.points || 0), pen: Number(r.penalty_points || 0) }))
      .sort((a, b) => a.d.localeCompare(b.d));
    const points = dates.map((d) => {
      const soFar = mine.filter((m) => m.d <= d);
      const sorted = soFar.map((m) => m.p).sort((a, b) => b - a);
      const counted = cap ? sorted.slice(0, cap) : sorted;
      const extra = cap ? Math.max(sorted.length - cap, 0) * league.extra_per_result : 0;
      const penalties = soFar.reduce((n, m) => n + m.pen, 0);
      return Math.round((counted.reduce((n, p) => n + p, 0) + extra + penalties) * 100) / 100;
    });
    return { id: t.player_id, name: t.display_name, points };
  });
  return { dates, players };
}

export async function prizesFor(db: Db, seasonId: number, league: LeagueSlug): Promise<Prize[]> {
  const { data } = await db
    .from("season_prizes")
    .select("position_from, position_to, prize_description, prize_amount")
    .eq("season_id", seasonId)
    .eq("league", league)
    .order("position_from");
  return (data || []) as Prize[];
}
