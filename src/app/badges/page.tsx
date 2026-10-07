import { pageMeta } from "@/lib/site";
import Medal from "@/components/badges/Medal";
import RuledHeading from "@/components/RuledHeading";
import { TitleBand } from "@/components/tournaments/ComingUp";
import { createSupabasePublicClient } from "@/lib/supabasePublic";
import { getSiteImages } from "@/lib/siteImages";
import { type BadgeDefinition, ACHIEVEMENTS, BADGE_CATEGORY_ORDER, TIER_LABEL } from "@/lib/badges";

export const metadata = pageMeta({
  title: "Badges & achievements",
  description: "Every title you can win and every milestone you can reach in the National Poker League, and how to earn them.",
  path: "/badges",
});
export const revalidate = 600;

/** Share of all players who reached a level: "<0.1%", "0.4%", "6.8%", "56%". */
function percent(held: number, players: number) {
  if (!players || held === 0) return "0%";
  const p = (held / players) * 100;
  if (p < 0.1) return "<0.1%";
  return p < 10 ? `${p.toFixed(1)}%` : `${Math.round(p)}%`;
}

/**
 * The badges guide: what there is to earn and how. Who won what lives on the Hall of Fame and on player
 * profiles; this page only explains the badges themselves.
 */
export default async function BadgesPage() {
  const img = await getSiteImages();
  const supabase = createSupabasePublicClient();
  const [{ data }, { data: stats }, { count: playerCount }] = await Promise.all([
    supabase.from("badge_definitions").select("*").eq("is_active", true).order("display_order"),
    supabase.from("badge_stats").select("key, holders"),
    supabase.from("players").select("id", { count: "exact", head: true }),
  ]);
  const defs = (data || []) as BadgeDefinition[];
  const holders = new Map((stats || []).map((s: any) => [s.key as string, Number(s.holders ?? 0)]));
  const players = playerCount ?? 0;

  const titles = defs.filter((d) => d.kind === "badge");
  const achievements = defs.filter((d) => d.kind === "achievement");
  const categories = [...new Set(titles.map((d) => d.category))].sort(
    (a, b) => (BADGE_CATEGORY_ORDER.indexOf(a) + 1 || 99) - (BADGE_CATEGORY_ORDER.indexOf(b) + 1 || 99)
  );
  const ladders = ACHIEVEMENTS.map((a) => ({
    ...a,
    levels: achievements.filter((d) => d.condition_type === a.type).sort((x, y) => (x.condition_value?.min ?? 0) - (y.condition_value?.min ?? 0)),
  })).filter((l) => l.levels.length);

  return (
    <div className="bg-season-night font-season text-season-ink">
      <TitleBand image={img.profile_hero} position="object-[100%_45%]" zoom="origin-[80%_40%] scale-[1.2]">
        <h1 className="text-[clamp(2.5rem,4.4vw,4.375rem)] font-bold leading-[1.02] tracking-[-0.012em]">Badges &amp; achievements</h1>
        <p className="mt-3 max-w-[40em] text-[clamp(1.0625rem,1.45vw,1.375rem)] font-medium text-season-muted">
          Titles are won at the table. Achievements are milestones you reach over time, in six levels from Bronze to Legendary.
        </p>
        <nav aria-label="On this page" className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[0.9375rem] font-medium">
          <a href="#titles" className="inline-flex min-h-11 items-center text-season-ink/85 underline decoration-season-ink/30 underline-offset-4 hover:decoration-season-ink">
            {titles.length} titles
          </a>
          <a href="#achievements" className="inline-flex min-h-11 items-center text-season-ink/85 underline decoration-season-ink/30 underline-offset-4 hover:decoration-season-ink">
            {ladders.length} achievement ladders
          </a>
        </nav>
      </TitleBand>

      <div className="space-y-[clamp(2.75rem,4.5vw,4rem)] px-4 pb-[clamp(2.5rem,4vw,4rem)] pt-[clamp(0.5rem,1.5vw,1.5rem)] sm:px-[3.6vw]">
        {/* Titles: one card each, the seal and how to win it */}
        <section id="titles" aria-labelledby="titles-heading" className="scroll-mt-24">
          <RuledHeading id="titles-heading">Titles: win one</RuledHeading>
          <div className="mt-5 space-y-8">
            {categories.map((cat) => (
              <div key={cat}>
                <h3 className="text-[1.0625rem] font-medium text-season-muted">{cat}</h3>
                <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {titles
                    .filter((d) => d.category === cat)
                    .map((d) => (
                      <li key={d.key} className="flex items-center gap-4 border border-white/[0.08] bg-[linear-gradient(180deg,#0f3337_0%,#0a2427_100%)] p-4">
                        <Medal def={d} size={76} />
                        <div className="min-w-0">
                          <h4 className="text-[1.0625rem] font-semibold leading-snug">{d.name}</h4>
                          <p className="mt-1 text-[0.9375rem] leading-snug text-season-ink/75">{d.description}</p>
                        </div>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Achievements: each ladder as a climb from the first level to the last */}
        <section id="achievements" aria-labelledby="achievements-heading" className="scroll-mt-24">
          <RuledHeading id="achievements-heading">Achievements: reach a milestone</RuledHeading>
          <p className="mt-2 text-[0.9375rem] text-season-muted">
            Levels: {(["bronze", "silver", "gold", "emerald", "diamond", "purple"] as const).map((t) => TIER_LABEL[t]).join(" · ")}. The percentage is the share of all players who have reached each level.
          </p>
          <div className="mt-5 space-y-3">
            {ladders.map(({ type, title, unit, levels }) => (
              <section key={type} aria-labelledby={`ach-${type}`} className="grid gap-x-6 gap-y-3 border border-white/[0.08] bg-[linear-gradient(180deg,#0f3337_0%,#0a2427_100%)] p-4 lg:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] lg:items-center lg:p-5">
                <h3 id={`ach-${type}`} className="text-[1.25rem] font-semibold leading-tight">{title}</h3>
                <ol className="relative grid grid-cols-3 gap-y-5 sm:grid-cols-6">
                  {/* The line the levels sit on */}
                  <span aria-hidden="true" className="absolute inset-x-[8%] top-[34px] hidden h-px bg-white/[0.14] sm:block" />
                  {levels.map((d) => (
                    <li key={d.key} className="relative flex flex-col items-center px-1 text-center">
                      <span className="rounded-full bg-[#0c2a2e] p-0.5">
                        <Medal def={d} size={64} />
                      </span>
                      <span className="mt-2 text-[0.9375rem] font-semibold leading-snug">{d.name}</span>
                      <span className="text-[0.8125rem] text-season-muted">{unit(d.condition_value?.min ?? 1)}</span>
                      <span className="mt-1 text-[0.875rem] font-semibold tabular-nums text-season-amber" title="Share of all players who have reached this level">
                        {percent(holders.get(d.key) ?? 0, players)}
                        <span className="sr-only"> of players have reached this</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
