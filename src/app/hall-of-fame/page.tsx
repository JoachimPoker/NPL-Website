import Link from "next/link";
import { pageMeta } from "@/lib/site";
import { Award, Coins, Crown, Gem, Medal, Sparkles, Target, Trophy, type LucideIcon } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Initial } from "@/components/HomeLeaderboard";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { gbp } from "@/lib/tournaments";
import { getLeagueLogos } from "@/lib/leagues";

export const metadata = pageMeta({ title: "Hall of Fame", description: "Champions and all-time records of the National Poker League.", path: "/hall-of-fame" });
export const revalidate = 3600;

type Podium = {
  season_id: number; season_name: string; year: number; is_active: boolean;
  league_slug: string; league_label: string; position: number;
  player_id: number; display_name: string; total_points: number;
};
type RecordRow = {
  record: string; rank: number; player_id: number; display_name: string;
  value: number; detail: string | null; event_id: number | null;
};

/** "titles" → "title", "cashes" → "cash", "final tables" → "final table". */
const singular = (unit: string) => unit.replace(/(sh)es$|s$/, "$1");

const RECORDS: { key: string; title: string; icon: LucideIcon; money?: boolean; unit?: string }[] = [
  { key: "most_wins", title: "Most wins", icon: Trophy, unit: "wins" },
  { key: "most_final_tables", title: "Most final tables", icon: Target, unit: "final tables" },
  { key: "most_money", title: "Most prize money", icon: Gem, money: true },
  { key: "biggest_cash", title: "Biggest single cash", icon: Sparkles, money: true },
  { key: "most_main_events", title: "Most Main Event titles", icon: Crown, unit: "titles" },
  { key: "most_cashes", title: "Most cashes", icon: Coins, unit: "cashes" },
  { key: "most_badges", title: "Most badges", icon: Award, unit: "badges" },
];

const LEAGUE_SHORT: Record<string, string> = { npl: "NPL", hrl: "High Roller", lrl: "Low Roller" };

export default async function HallOfFamePage() {
  const supabase = await createSupabaseServerClient();
  const [{ data: podiumData }, { data: recordData }, leagueLogos] = await Promise.all([
    supabase.rpc("hall_of_fame_podiums"),
    supabase.rpc("hall_of_fame_records", { p_limit: 5 }),
    getLeagueLogos(),
  ]);
  const podiums = (podiumData || []) as Podium[];
  const records = (recordData || []) as RecordRow[];

  // Seasons (newest first) -> leagues -> top 3
  const seasons = new Map<number, { name: string; year: number; active: boolean; leagues: Map<string, Podium[]> }>();
  for (const p of podiums) {
    const s = seasons.get(p.season_id) ?? { name: p.season_name, year: p.year, active: p.is_active, leagues: new Map() };
    const list = s.leagues.get(p.league_slug) ?? [];
    list.push(p);
    s.leagues.set(p.league_slug, list);
    seasons.set(p.season_id, s);
  }

  // Roll of honour: titles from finished seasons.
  const titles = new Map<number, { id: number; name: string; wins: { league: string; year: number }[] }>();
  for (const p of podiums) {
    if (p.is_active || p.position !== 1) continue;
    const t = titles.get(p.player_id) ?? { id: p.player_id, name: p.display_name, wins: [] };
    t.wins.push({ league: LEAGUE_SHORT[p.league_slug] ?? p.league_label, year: p.year });
    titles.set(p.player_id, t);
  }
  const roll = [...titles.values()].sort((a, b) => b.wins.length - a.wins.length || a.name.localeCompare(b.name));

  const byRecord = new Map<string, RecordRow[]>();
  for (const r of records) byRecord.set(r.record, [...(byRecord.get(r.record) ?? []), r]);

  return (
    <>
      <PageHeader
        size="large"
        eyebrow="Hall of Fame"
        title="Legends of the league"
        description="Every season's champions and the records that still stand."
      />

      <div className="mx-auto w-full max-w-7xl space-y-16 px-4 py-12 sm:px-6 lg:px-8">
        {/* Champions by season */}
        <section aria-labelledby="champions" className="space-y-10">
          <h2 id="champions" className="font-display text-2xl font-semibold tracking-tight">Season champions</h2>
          {[...seasons.values()].map((s) => (
            <div key={s.year} className="space-y-4">
              <div className="flex items-baseline gap-3">
                <h3 className="font-display text-xl font-semibold">{s.name}</h3>
                {s.active && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" aria-hidden="true" />
                    In progress: current leaders
                  </span>
                )}
              </div>
              <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {[...s.leagues.entries()].map(([slug, podium]) => {
                  const [first, ...rest] = podium;
                  return (
                    <li key={slug} className={`panel relative overflow-hidden p-6 ${s.active ? "" : "ring-1 ring-primary/25"}`}>
                      {!s.active && <div className="felt-glow pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />}
                      <div className="relative">
                        {leagueLogos.get(slug) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={leagueLogos.get(slug)} alt={first.league_label} className="h-9 w-auto max-w-64 rounded-[4px] object-contain object-left" />
                        ) : (
                          <div className="eyebrow">{first.league_label}</div>
                        )}
                        <div className="mt-4 flex items-center gap-4">
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/30">
                            <Crown size={22} aria-hidden="true" />
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs uppercase tracking-wider text-base-content/45">{s.active ? "Leader" : "Champion"}</div>
                            <Link href={`/players/${first.player_id}`} className="block truncate font-display text-2xl font-semibold hover:text-primary">
                              {first.display_name}
                            </Link>
                            <div className="font-mono text-sm text-base-content/55">{Number(first.total_points).toFixed(2)} pts</div>
                          </div>
                        </div>
                        {rest.length > 0 && (
                          <ol className="mt-5 space-y-2 border-t border-base-content/[0.07] pt-4">
                            {rest.map((p) => (
                              <li key={p.player_id} className="flex items-center justify-between gap-3 text-sm">
                                <span className="flex min-w-0 items-center gap-2">
                                  <Medal size={14} className="shrink-0 text-base-content/40" aria-hidden="true" />
                                  <span className="w-5 font-mono text-xs text-base-content/45">{p.position}.</span>
                                  <Link href={`/players/${p.player_id}`} className="truncate hover:text-primary">{p.display_name}</Link>
                                </span>
                                <span className="shrink-0 font-mono text-xs text-base-content/50">{Number(p.total_points).toFixed(2)}</span>
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>

        {/* Roll of honour */}
        {roll.length > 0 && (
          <section aria-labelledby="roll">
            <h2 id="roll" className="mb-5 font-display text-2xl font-semibold tracking-tight">Roll of honour</h2>
            <ul className="panel divide-y divide-base-content/[0.06]">
              {roll.map((t) => (
                <li key={t.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <Link href={`/players/${t.id}`} className="group flex items-center gap-3 font-medium">
                    <Initial name={t.name} />
                    <span className="font-display text-lg transition-colors group-hover:text-primary">{t.name}</span>
                  </Link>
                  <ul className="flex flex-wrap gap-2">
                    {t.wins.sort((a, b) => b.year - a.year).map((w) => (
                      <li key={`${w.league}-${w.year}`} className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary ring-1 ring-inset ring-primary/20">
                        <Crown size={12} aria-hidden="true" /> {w.league} {w.year}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* All-time records */}
        <section aria-labelledby="records">
          <h2 id="records" className="mb-5 font-display text-2xl font-semibold tracking-tight">All-time records</h2>
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {RECORDS.map(({ key, title, icon: Icon, money, unit }) => {
              const rows = byRecord.get(key) ?? [];
              if (!rows.length) return null;
              const [top, ...others] = rows;
              const fmt = (v: number) => (money ? gbp(Number(v)) : `${Number(v).toLocaleString("en-GB")}${unit ? ` ${Number(v) === 1 ? singular(unit) : unit}` : ""}`);
              return (
                <li key={key} className="panel flex flex-col p-6">
                  <div className="flex items-center gap-2 text-sm text-base-content/55">
                    <Icon size={16} className="text-primary" aria-hidden="true" /> {title}
                  </div>
                  <Link href={`/players/${top.player_id}`} className="mt-3 truncate font-display text-2xl font-semibold hover:text-primary">
                    {top.display_name}
                  </Link>
                  <div className="font-mono text-lg text-primary">{fmt(top.value)}</div>
                  {top.detail && (
                    top.event_id
                      ? <Link href={`/events/e/${top.event_id}`} className="mt-1 line-clamp-2 text-xs text-base-content/50 hover:text-primary">{top.detail}</Link>
                      : <p className="mt-1 text-xs text-base-content/50">{top.detail}</p>
                  )}
                  {others.length > 0 && (
                    <ol className="mt-5 space-y-1.5 border-t border-base-content/[0.07] pt-4 text-sm">
                      {others.map((r) => (
                        <li key={`${r.record}-${r.rank}`} className="flex items-center justify-between gap-3">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="w-5 font-mono text-xs text-base-content/40">{r.rank}.</span>
                            <Link href={`/players/${r.player_id}`} className="truncate hover:text-primary">{r.display_name}</Link>
                          </span>
                          <span className="shrink-0 font-mono text-xs text-base-content/50">{fmt(r.value)}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </>
  );
}
