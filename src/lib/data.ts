import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { getCareer } from "@/lib/career";
import { type BadgeDefinition, type PlayerBadge, ACHIEVEMENTS, BADGE_CATEGORY_ORDER, baseKey } from "@/lib/badges";

export async function getPlayerProfile(id: string) {
  const playerId = Number(id);
  const career = await getCareer(playerId);
  if (!career) return null;
  const { player, results, totals, seasons } = career;

  const supabase = await createSupabaseServerClient();
  const [{ data: awards }, { data: badgeDefs }, { data: seriesRows }] = await Promise.all([
    supabase.from("player_badges").select("id, badge_key, badge_name, season_year, awarded_at, awarded_by, event_id, festival_id, occasion").eq("player_id", playerId),
    supabase.from("badge_definitions").select("*").eq("is_active", true).order("display_order"),
    supabase.from("series").select("id, name"),
  ]);
  const defs = (badgeDefs || []) as BadgeDefinition[];
  const defByKey = new Map(defs.map((d) => [d.key, d]));
  const earned = ((awards || []) as PlayerBadge[])
    .map((award) => ({ award, def: defByKey.get(baseKey(award.badge_key)) }))
    .filter((b): b is { award: PlayerBadge; def: BadgeDefinition } => !!b.def);

  // Titles (badges): one entry per badge with how often and where it was won.
  const titleMap = new Map<string, { def: BadgeDefinition; occasions: { label: string; year: number | null }[] }>();
  for (const { award, def } of earned.filter((b) => b.def.kind === "badge")) {
    const t = titleMap.get(def.key) ?? { def, occasions: [] };
    t.occasions.push({ label: award.occasion ?? (award.season_year ? String(award.season_year) : ""), year: award.season_year });
    titleMap.set(def.key, t);
  }
  const titles = [...titleMap.values()]
    .map((t) => ({ ...t, occasions: t.occasions.sort((a, b) => (b.year ?? 0) - (a.year ?? 0)) }))
    .sort((a, b) =>
      (BADGE_CATEGORY_ORDER.indexOf(a.def.category) + 1 || 99) - (BADGE_CATEGORY_ORDER.indexOf(b.def.category) + 1 || 99) ||
      (a.def.display_order ?? 0) - (b.def.display_order ?? 0)
    );

  // Achievements: the numbers each ladder counts (same rules as award_badges in the database).
  const isOnline = (r: (typeof results)[number]) => /^online$/i.test(r.casino ?? "") || /online/i.test(r.event_name);
  const perSeason = new Map<number, number>();
  for (const r of results) if (r.season_id) perSeason.set(r.season_id, (perSeason.get(r.season_id) ?? 0) + 1);
  const stat: Record<string, number> = {
    cashes: totals.cashes,
    wins: totals.wins,
    final_tables: totals.final_tables,
    money: totals.money,
    biggest_cash: results.reduce((m, r) => Math.max(m, r.prize), 0),
    points: totals.points,
    venues: new Set(results.filter((r) => !isOnline(r)).map((r) => r.casino).filter(Boolean)).size,
    series_won: new Set(results.filter((r) => r.position === 1 && r.series_id).map((r) => r.series_id)).size,
    festivals: new Set(results.map((r) => r.festival_id).filter(Boolean)).size,
    hr_cashes: results.filter((r) => r.high_roller).length,
    online_cashes: results.filter(isOnline).length,
    seasons: new Set(results.map((r) => r.season_id).filter(Boolean)).size,
    season_cashes: Math.max(0, ...perSeason.values()),
    npl_top10_count: seasons.filter((s) => !s.active && (s.leagues.npl?.position ?? 99) <= 10).length,
  };
  const earnedKeys = new Set(earned.map((b) => b.def.key));
  const achievements = ACHIEVEMENTS.flatMap(({ type, title, unit }) => {
    const levels = defs
      .filter((d) => d.kind === "achievement" && d.condition_type === type)
      .sort((a, b) => (a.condition_value?.min ?? 0) - (b.condition_value?.min ?? 0));
    if (!levels.length) return [];
    const reached = levels.filter((d) => earnedKeys.has(d.key));
    const level = reached[reached.length - 1] ?? null;
    const next = levels.find((d) => !earnedKeys.has(d.key)) ?? null;
    return [{ type, title, unit, current: stat[type] ?? 0, level, next, target: next?.condition_value?.min ?? null, levels: levels.length, reachedCount: reached.length }];
  });

  // Rank history this season (NPL snapshots taken at each import).
  const activeSeason = seasons.find((s) => s.active);
  const { data: activeSeasonRow } = await supabase.from("seasons").select("id").eq("is_active", true).maybeSingle();
  const [{ data: history }, { data: nplLeague }] = await Promise.all([
    supabase
      .from("leaderboard_positions")
      .select("position, points, snapshot_date")
      .eq("player_id", playerId)
      .eq("league", "npl")
      .eq("season_id", activeSeasonRow?.id ?? -1)
      .order("snapshot_date", { ascending: true }),
    supabase
      .from("leagues")
      .select("scoring_method, scoring_cap, league_bonuses(bonus_type, points_value)")
      .eq("season_id", activeSeasonRow?.id ?? -1)
      .eq("slug", "npl")
      .maybeSingle(),
  ]);

  // NPL points building up over this season, using the league's rules (best N + bonus per extra cash).
  const cap = nplLeague?.scoring_method === "capped" ? nplLeague.scoring_cap ?? null : null;
  const extra = ((nplLeague?.league_bonuses as any[]) || [])
    .filter((b) => b.bonus_type === "participation_after_cap")
    .reduce((n, b) => n + Number(b.points_value || 0), 0);
  const seasonResults = results
    .filter((r) => r.season_id === activeSeasonRow?.id && r.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const season_progress: { date: string; points: number; event: string }[] = [];
  for (let i = 0; i < seasonResults.length; i++) {
    const soFar = seasonResults.slice(0, i + 1).map((r) => r.points).sort((x, y) => y - x);
    const counted = cap ? soFar.slice(0, cap) : soFar;
    const total = counted.reduce((n, p) => n + p, 0) + (cap ? Math.max(soFar.length - cap, 0) * extra : 0);
    season_progress.push({ date: seasonResults[i].date!, points: Math.round(total * 100) / 100, event: seasonResults[i].event_name });
  }

  return {
    player,
    stats: {
      lifetime_points: totals.points,
      total_earnings: totals.money,
      total_wins: totals.wins,
      final_tables: totals.final_tables,
      current_rank: activeSeason?.leagues.npl?.position ?? null,
      results_count: totals.cashes,
      best_finish: totals.best_finish,
    },
    titles,
    achievements,
    seasons,
    season_progress,
    best_results: [...results].sort((a, b) => b.prize - a.prize || b.points - a.points).slice(0, 5),
    graph_data: (history || []).map((h: any) => ({ date: h.snapshot_date, rank: h.position, points: h.points })),
    // Every cash (newest first) for the Results tab, and the series names for its filters.
    all_results: results,
    series_names: new Map((seriesRows || []).map((s) => [s.id as number, s.name as string])),
    recent_results: results.slice(0, 50).map((r) => ({
      id: r.id,
      points: r.points,
      prize_amount: r.prize,
      position_of_prize: r.position,
      event: { id: r.event_id, name: r.event_name, start_date: r.date, site_name: r.casino },
    })),
  };
}
