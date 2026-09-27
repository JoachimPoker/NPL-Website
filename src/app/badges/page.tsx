import Link from "next/link";
import { pageMeta } from "@/lib/site";
import PageHeader from "@/components/PageHeader";
import BadgeMedal from "@/components/badges/BadgeMedal";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { displayName } from "@/lib/nameMask";
import { type BadgeDefinition, type BadgeTier, ACHIEVEMENTS, BADGE_CATEGORY_ORDER, TIER_LABEL } from "@/lib/badges";

export const metadata = pageMeta({
  title: "Badges & achievements",
  description: "Titles won and milestones reached in the National Poker League.",
  path: "/badges",
});
export const revalidate = 600;

const LIST_ALL_UP_TO = 8; // badges held by this many players or fewer list everyone
const SAMPLE_SIZE = 6;    // otherwise show this many names and "+ N more"

// Tier chip colours, matching the medal metals.
const TIER_CHIP: Record<BadgeTier, string> = {
  bronze: "bg-[oklch(55%_0.09_55/0.18)] text-[oklch(78%_0.09_60)] ring-[oklch(66%_0.09_55/0.4)]",
  silver: "bg-[oklch(80%_0.01_250/0.14)] text-[oklch(90%_0.01_250)] ring-[oklch(85%_0.01_250/0.35)]",
  gold: "bg-[oklch(75%_0.12_80/0.16)] text-[oklch(85%_0.12_85)] ring-[oklch(80%_0.12_80/0.4)]",
  emerald: "bg-[oklch(66%_0.15_158/0.18)] text-[oklch(82%_0.13_158)] ring-[oklch(70%_0.15_158/0.45)]",
  diamond: "bg-[oklch(85%_0.09_215/0.16)] text-[oklch(92%_0.06_215)] ring-[oklch(88%_0.08_215/0.45)]",
  purple: "bg-[oklch(60%_0.17_300/0.2)] text-[oklch(82%_0.12_305)] ring-[oklch(70%_0.17_305/0.45)]",
};

type Holder = { id: number; name: string; times: number; years: number[] };

/** Share of all players, always shown: "<0.1%", "0.4%", "6.8%", "56%". */
function percent(held: number, players: number) {
  if (!players || held === 0) return "0%";
  const p = (held / players) * 100;
  if (p < 0.1) return "<0.1%";
  return p < 10 ? `${p.toFixed(1)}%` : `${Math.round(p)}%`;
}

function TierChip({ tier }: { tier: BadgeTier }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${TIER_CHIP[tier]}`}>
      {TIER_LABEL[tier]}
    </span>
  );
}

export default async function BadgesPage(props: { searchParams: Promise<{ tab?: string }> }) {
  const tab = (await props.searchParams).tab === "achievements" ? "achievements" : "badges";
  const supabase = await createSupabaseServerClient();

  const [{ data: defsData }, { data: stats }, { count: playerCount }] = await Promise.all([
    supabase.from("badge_definitions").select("*").eq("is_active", true).order("display_order"),
    supabase.from("badge_stats").select("key, holders, awards"),
    supabase.from("players").select("id", { count: "exact", head: true }),
  ]);
  const defs = (defsData || []) as BadgeDefinition[];
  const statByKey = new Map((stats || []).map((s: any) => [s.key, s]));
  const held = (key: string) => Number(statByKey.get(key)?.holders ?? 0);
  const players = playerCount ?? 0;

  const badgeDefs = defs.filter((d) => d.kind === "badge");
  const achievementDefs = defs.filter((d) => d.kind === "achievement");
  const totalAwards = (stats || []).reduce((n: number, s: any) => n + Number(s.awards || 0), 0);

  // Holders per badge (badges tab only): each player once, with how often they won it.
  const holders = new Map<string, Holder[]>();
  if (tab === "badges") {
    const lists = await Promise.all(
      badgeDefs.map(async (d) => {
        const n = held(d.key);
        if (n === 0) return [d.key, [] as Holder[]] as const;
        const { data: awards } = await supabase
          .from("player_badges")
          .select("season_year, player:players(id, forename, surname, display_name, gdpr)")
          .or(`badge_key.eq.${d.key},badge_key.like.${d.key}@*`)
          .order("awarded_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(n <= LIST_ALL_UP_TO ? 200 : 60);
        const byPlayer = new Map<number, Holder>();
        for (const a of (awards || []) as any[]) {
          if (!a.player) continue;
          const h: Holder = byPlayer.get(a.player.id) ?? {
            id: a.player.id,
            name: displayName(a.player.forename, a.player.surname, !!a.player.gdpr, a.player.display_name),
            times: 0,
            years: [],
          };
          h.times++;
          if (a.season_year && !h.years.includes(a.season_year)) h.years.push(a.season_year);
          byPlayer.set(a.player.id, h);
        }
        const list = [...byPlayer.values()]
          .map((h) => ({ ...h, years: h.years.sort((x, y) => x - y) }))
          .sort((a, b) => b.times - a.times);
        return [d.key, n <= LIST_ALL_UP_TO ? list : list.slice(0, SAMPLE_SIZE)] as const;
      })
    );
    for (const [k, v] of lists) holders.set(k, v);
  }

  const badgeCategories = [...new Set(badgeDefs.map((d) => d.category))].sort(
    (a, b) => (BADGE_CATEGORY_ORDER.indexOf(a) + 1 || 99) - (BADGE_CATEGORY_ORDER.indexOf(b) + 1 || 99)
  );

  return (
    <>
      <PageHeader
        eyebrow="Badges & achievements"
        title="Earn your stripes"
        description="Badges are titles you win: series Main Events, league titles and more. Achievements are milestones you reach, in six levels from Bronze to Legendary."
      >
        <dl className="grid max-w-xl grid-cols-3 gap-6">
          <div>
            <dt className="eyebrow">Badges</dt>
            <dd className="mt-1 font-display text-3xl font-semibold">{badgeDefs.length}</dd>
          </div>
          <div>
            <dt className="eyebrow">Achievements</dt>
            <dd className="mt-1 font-display text-3xl font-semibold">{achievementDefs.length}</dd>
          </div>
          <div>
            <dt className="eyebrow">Awarded</dt>
            <dd className="mt-1 font-display text-3xl font-semibold">{totalAwards.toLocaleString("en-GB")}</dd>
          </div>
        </dl>
      </PageHeader>

      <div className="mx-auto w-full max-w-7xl space-y-12 px-4 py-10 sm:px-6 lg:px-8">
        <nav aria-label="Badges or achievements" className="inline-flex rounded-lg bg-base-100 p-1 ring-1 ring-inset ring-base-content/[0.07]">
          {[
            { key: "badges", label: "Badges", href: "/badges" },
            { key: "achievements", label: "Achievements", href: "/badges?tab=achievements" },
          ].map((t) => (
            <Link
              key={t.key}
              href={t.href}
              aria-current={tab === t.key ? "page" : undefined}
              className={`rounded-md px-5 py-2 text-sm font-medium transition-colors ${
                tab === t.key ? "bg-primary text-primary-content" : "text-base-content/60 hover:text-base-content"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        {tab === "badges" &&
          badgeCategories.map((cat) => (
            <section key={cat} aria-labelledby={`cat-${cat}`}>
              <h2 id={`cat-${cat}`} className="mb-5 font-display text-2xl font-semibold tracking-tight">{cat}</h2>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {badgeDefs.filter((d) => d.category === cat).map((d) => {
                  const n = held(d.key);
                  const awards = Number(statByKey.get(d.key)?.awards ?? 0);
                  const names = holders.get(d.key) ?? [];
                  const more = Math.max(n - names.length, 0);
                  return (
                    <li key={d.key} className="panel flex h-full flex-col gap-4 p-5">
                      {/* Fixed height so the stat boxes line up across a row. */}
                      <div className="flex min-h-[5.5rem] items-start gap-4">
                        <BadgeMedal tier="gold" icon={d.icon} imageUrl={d.image_url} />
                        <div className="min-w-0">
                          <h3 className="font-display text-lg font-semibold leading-tight">{d.name}</h3>
                          <p className="mt-0.5 text-sm text-base-content/60">{d.description}</p>
                        </div>
                      </div>

                      <dl className="grid grid-cols-2 gap-2 text-center">
                        <div className="rounded-lg bg-base-200/60 px-1 py-2">
                          <dt className="text-[10px] uppercase tracking-wider text-base-content/45">Players</dt>
                          <dd className="mt-1 font-mono text-sm font-semibold">{n.toLocaleString("en-GB")}</dd>
                        </div>
                        <div className="rounded-lg bg-base-200/60 px-1 py-2">
                          <dt className="text-[10px] uppercase tracking-wider text-base-content/45">Of players</dt>
                          <dd className="mt-1 font-mono text-sm font-semibold">{percent(n, players)}</dd>
                        </div>
                      </dl>

                      <div className="border-t border-base-content/[0.07] pt-3">
                        {n === 0 ? (
                          <p className="text-xs text-base-content/45">Nobody has won this yet.</p>
                        ) : (
                          <>
                            <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-base-content/45">
                              <span>{n <= LIST_ALL_UP_TO ? "Won by" : "Won by players including"}</span>
                              {awards > n && <span>{awards.toLocaleString("en-GB")} times in total</span>}
                            </div>
                            <ul className="flex flex-wrap gap-1.5">
                              {names.map((h) => (
                                <li key={h.id}>
                                  <Link
                                    href={`/players/${h.id}`}
                                    className="inline-flex rounded-md bg-base-200/70 px-2 py-0.5 text-xs transition-colors hover:text-primary"
                                  >
                                    {h.name}
                                    {h.times > 1 && <span className="ml-1 font-semibold text-primary">×{h.times}</span>}
                                    {h.times === 1 && h.years.length > 0 && <span className="ml-1 text-base-content/45">{h.years.join(", ")}</span>}
                                  </Link>
                                </li>
                              ))}
                              {more > 0 && (
                                <li className="inline-flex items-center px-1 text-xs text-base-content/45">+ {more.toLocaleString("en-GB")} more</li>
                              )}
                            </ul>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

        {tab === "achievements" && (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {ACHIEVEMENTS.map(({ type, title, unit }) => {
              const levels = achievementDefs
                .filter((d) => d.condition_type === type)
                .sort((a, b) => (a.condition_value?.min ?? 0) - (b.condition_value?.min ?? 0));
              if (!levels.length) return null;
              return (
                <li key={type} className="panel p-5">
                  <h2 className="font-display text-lg font-semibold">{title}</h2>
                  <ol className="mt-4 space-y-2">
                    {levels.map((d) => {
                      const n = held(d.key);
                      return (
                        <li key={d.key} className="flex items-center gap-3 rounded-lg bg-base-200/50 px-3 py-2">
                          <BadgeMedal tier={d.tier} icon={d.icon} imageUrl={d.image_url} size="sm" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-semibold">{d.name}</span>
                              <TierChip tier={d.tier} />
                            </div>
                            <div className="text-xs text-base-content/50">{unit(d.condition_value?.min ?? 1)}</div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="font-mono text-sm font-semibold">{n.toLocaleString("en-GB")}</div>
                            <div className="font-mono text-[11px] text-base-content/50">{percent(n, players)}</div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
