/** Achievement levels, lowest to highest ("purple" is Legendary). Badges all use "gold". */
export type BadgeTier = "bronze" | "silver" | "gold" | "emerald" | "diamond" | "purple";

/** "badge" = a title you win (can be won repeatedly); "achievement" = a number milestone. */
export type BadgeKind = "badge" | "achievement";

export type BadgeDefinition = {
  id: number;
  key: string;
  name: string;
  description: string;
  icon: string | null;
  image_url: string | null;
  tier: BadgeTier;
  category: string;
  condition_type: string;
  condition_value: Record<string, number> | null;
  rarity: string | null;
  is_active: boolean | null;
  display_order: number | null;
  kind: BadgeKind | string;
  series_id: number | null;
};

export type PlayerBadge = {
  id: number;
  badge_key: string;
  badge_name: string;
  season_year: number | null;
  awarded_at: string | null;
  awarded_by: string | null;
  event_id?: number | null;
  festival_id?: string | null;
  occasion?: string | null;
};

export const TIER_ORDER: Record<BadgeTier, number> = { purple: 0, diamond: 1, emerald: 2, gold: 3, silver: 4, bronze: 5 };
/** Achievement levels, lowest first. */
export const LEVEL_ORDER: BadgeTier[] = ["bronze", "silver", "gold", "emerald", "diamond", "purple"];

export const TIER_LABEL: Record<BadgeTier, string> = {
  bronze: "Bronze", silver: "Silver", gold: "Gold", emerald: "Emerald", diamond: "Diamond", purple: "Legendary",
};

/** Badge (title) groups, in page order. */
export const BADGE_CATEGORY_ORDER = ["League titles", "Series titles", "Other titles", "Special"];

/** Achievement ladders, in page order: the stat they count and how to show a threshold. */
export const ACHIEVEMENTS: { type: string; title: string; unit: (n: number) => string }[] = [
  { type: "cashes", title: "Cashes", unit: (n) => `${n.toLocaleString("en-GB")} cashes` },
  { type: "wins", title: "Wins", unit: (n) => `${n.toLocaleString("en-GB")} win${n === 1 ? "" : "s"}` },
  { type: "final_tables", title: "Final tables", unit: (n) => `${n.toLocaleString("en-GB")} final tables` },
  { type: "money", title: "Career winnings", unit: (n) => `£${n.toLocaleString("en-GB")}` },
  { type: "biggest_cash", title: "Biggest cash", unit: (n) => `£${n.toLocaleString("en-GB")} in one go` },
  { type: "points", title: "League points", unit: (n) => `${n.toLocaleString("en-GB")} points` },
  { type: "venues", title: "Venues", unit: (n) => `${n} venues` },
  { type: "series_won", title: "Series won", unit: (n) => `wins in ${n} series` },
  { type: "festivals", title: "Festivals", unit: (n) => `${n} festivals` },
  { type: "hr_cashes", title: "High Roller", unit: (n) => `${n} High Roller cash${n === 1 ? "" : "es"}` },
  { type: "online_cashes", title: "Online closers", unit: (n) => `${n} online closer${n === 1 ? "" : "s"}` },
  { type: "seasons", title: "Seasons played", unit: (n) => `${n} seasons` },
  { type: "season_cashes", title: "Cashes in a season", unit: (n) => `${n} cashes in a season` },
  { type: "npl_top10_count", title: "NPL top 10", unit: (n) => `${n} top-10 finish${n === 1 ? "" : "es"}` },
];
export const ACHIEVEMENT_TYPES = ACHIEVEMENTS.map((a) => a.type);

/** "npl_champion@2025" / "series_gukpt@1156…" -> the definition key. */
export const baseKey = (badgeKey: string) => badgeKey.split("@")[0];

export const CONDITION_LABEL: Record<string, string> = {
  wins: "Tournament wins",
  cashes: "Cashes",
  final_tables: "Final tables (top 9)",
  events_played: "Events played",
  money: "Career winnings (£)",
  biggest_cash: "Biggest single cash (£)",
  points: "Career league points",
  venues: "Different venues cashed at",
  series_won: "Different series won in",
  festivals: "Different festivals cashed in",
  hr_cashes: "High Roller cashes",
  online_cashes: "Online closer cashes",
  seasons: "Seasons cashed in",
  season_cashes: "Cashes in one season",
  npl_top10_count: "NPL top-10 season finishes",
  series_title: "Series title (set up automatically per series)",
  season_rank_npl: "NPL finishing position",
  season_rank_hr: "High Roller League finishing position",
  season_rank_lrl: "Low Roller League finishing position",
  high_roller_win: "Win a High Roller event",
  festival_champion: "Top a festival leaderboard (retired)",
  alltime_leader: "First on a series' all-time leaderboard",
  special: "Awarded by hand",
};

/** Condition types an admin can pick for each kind. */
export const ACHIEVEMENT_CONDITIONS = ACHIEVEMENT_TYPES;
export const BADGE_CONDITIONS = ["season_rank_npl", "season_rank_hr", "season_rank_lrl", "high_roller_win", "alltime_leader", "special"];

/** The number(s) a condition compares against. */
export function conditionField(type: string): { field: "min" | "ranks" | null; label: string } {
  if (type.startsWith("season_rank")) return { field: "ranks", label: "Finishing positions" };
  if (ACHIEVEMENT_TYPES.includes(type)) return { field: "min", label: "At least" };
  return { field: null, label: "" };
}
