import { type BadgeDefinition, type BadgeTier, LEVEL_ORDER } from "@/lib/badges";

/** What a struck seal says: text round the top and bottom of the ring, the name in the middle and a line under it. */
export type SealText = {
  kind: "title" | "achievement";
  /** 1 (Bronze) to 6 (Legendary); 0 for titles. */
  level: number;
  top: string;
  centre: string;
  sub: string;
  bottom: string;
  /** How many level pips to strike; defaults to the level. 0 for a plain metal seal. */
  pips?: number;
};

/** Short centre names for series titles, by definition key. Anything not listed uses its own name. */
const SERIES: Record<string, { centre: string; ring: string }> = {
  series_g200: { centre: "G200", ring: "GROSVENOR" },
  series_g300: { centre: "G300", ring: "GROSVENOR" },
  series_25_50: { centre: "25/50", ring: "BLINDS SERIES" },
  series_mini_fest: { centre: "MINI", ring: "MINI FEST" },
  series_gukpt: { centre: "GUKPT", ring: "UK POKER TOUR" },
  series_ukpl: { centre: "UKPL", ring: "UK POKER LEAGUE" },
  series_888poker_live: { centre: "888", ring: "888POKER LIVE" },
  series_goliath: { centre: "GOLIATH", ring: "COVENTRY" },
  series_uk_open: { centre: "UK OPEN", ring: "OPEN SERIES" },
  series_behemoth: { centre: "BEHEMOTH", ring: "FESTIVAL SERIES" },
  series_season_specials: { centre: "SPECIALS", ring: "SEASON SPECIALS" },
};

const LEAGUES: Record<string, { centre: string; ring: string }> = {
  season_rank_npl: { centre: "NPL", ring: "NATIONAL LEAGUE" },
  season_rank_hr: { centre: "HRL", ring: "HIGH ROLLER LEAGUE" },
  season_rank_lrl: { centre: "LRL", ring: "LOW ROLLER LEAGUE" },
};

/** Ring text for each achievement ladder. */
const LADDER_RING: Record<string, string> = {
  cashes: "CASHES",
  wins: "WINS",
  final_tables: "FINAL TABLES",
  money: "CAREER WINNINGS",
  biggest_cash: "BIGGEST CASH",
  points: "LEAGUE POINTS",
  venues: "VENUES",
  series_won: "SERIES WON",
  festivals: "FESTIVALS",
  hr_cashes: "HIGH ROLLER CASHES",
  online_cashes: "ONLINE CLOSERS",
  seasons: "SEASONS PLAYED",
  season_cashes: "CASHES IN A SEASON",
  npl_top10_count: "NPL TOP 10 FINISHES",
  events_played: "EVENTS PLAYED",
};

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "TH" : ["TH", "ST", "ND", "RD"][n % 10] ?? "TH"}`;

/** 10000 -> "£10K", 1000000 -> "£1M", 1500 -> "1,500". */
export function sealNumber(type: string, n: number): string {
  if (type === "money" || type === "biggest_cash") {
    if (n >= 1_000_000) return `£${+(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `£${+(n / 1_000).toFixed(1)}K`;
    return `£${n}`;
  }
  return n.toLocaleString("en-GB");
}

/** A name short enough for the centre: as is up to 8 letters, else its initials ("CHRISTMAS CRACKER" -> "CC"). */
function centreName(name: string): string {
  if (name.length <= 8) return name;
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length > 1) return words.map((w) => w[0]).join("").slice(0, 5);
  return name.slice(0, 8);
}

export const levelOf = (tier: BadgeTier) => LEVEL_ORDER.indexOf(tier) + 1 || 1;

/**
 * The seal for a badge definition. `year` (and `awardedAt` for Player of the Month) come from a
 * player's award; without them the seal shows the badge in general, as on the badges page.
 */
export function sealText(def: BadgeDefinition, opts: { year?: number | null; awardedAt?: string | null } = {}): SealText {
  const { year } = opts;
  const season = year ? `SEASON ${year}` : "";

  if (def.kind === "achievement") {
    const min = def.condition_value?.min ?? 0;
    return {
      kind: "achievement",
      level: levelOf(def.tier),
      top: LADDER_RING[def.condition_type] ?? def.category.toUpperCase(),
      centre: sealNumber(def.condition_type, min),
      sub: "",
      bottom: def.name.toUpperCase(),
    };
  }

  const title = (t: Omit<SealText, "kind" | "level">): SealText => ({ kind: "title", level: 0, ...t });

  const league = LEAGUES[def.condition_type];
  if (league) {
    const lo = def.condition_value?.min_rank ?? 1;
    const hi = def.condition_value?.max_rank ?? lo;
    const rank = lo === 1 && hi === 1 ? "CHAMPION" : lo === hi ? ordinal(lo) : hi - lo === 1 ? `${ordinal(lo)} · ${ordinal(hi)}` : `${ordinal(lo)}–${ordinal(hi)}`;
    return title({ top: season || "LEAGUE TITLE", centre: league.centre, sub: rank, bottom: league.ring });
  }

  if (def.condition_type === "series_title") {
    const s = SERIES[def.key];
    const name = def.name.replace(/\s+winner$/i, "").toUpperCase();
    return title({ top: s?.ring ?? name, centre: s?.centre ?? centreName(name), sub: "WINNER", bottom: season || "SERIES TITLE" });
  }

  if (def.condition_type === "high_roller_win") {
    return title({ top: season || "HIGH ROLLER", centre: "HR", sub: "WINNER", bottom: "HIGH ROLLER EVENT" });
  }

  if (def.condition_type === "alltime_leader") {
    return title({ top: "ALL-TIME", centre: "No.1", sub: "SERIES", bottom: "SERIES LEADERBOARD" });
  }

  if (def.condition_type === "festival_champion") {
    return title({ top: "FESTIVAL", centre: "No.1", sub: year ? String(year) : "OVERALL", bottom: "LEADERBOARD" });
  }

  if (def.key === "player_of_month") {
    const d = opts.awardedAt ? new Date(opts.awardedAt) : null;
    const ok = d && !Number.isNaN(d.getTime());
    return title({
      top: "PLAYER OF THE",
      centre: ok ? MONTHS[d.getMonth()]! : "POTM",
      sub: ok ? String(d.getFullYear()) : year ? String(year) : "",
      bottom: "MONTH",
    });
  }

  // Anything else (hand-awarded specials added in admin): its name, shortened.
  const name = def.name.toUpperCase();
  return title({ top: season || def.category.toUpperCase(), centre: centreName(name), sub: "", bottom: name.length <= 8 ? "NPL" : name });
}
