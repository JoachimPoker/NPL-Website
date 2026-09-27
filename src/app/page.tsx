import Link from "next/link";
import { ArrowRight, CircleDot, Eye, TrendingUp, Trophy } from "lucide-react";
import HomeLeaderboard from "@/components/HomeLeaderboard";
import { getHomeExtras, SeasonStrip, ComingUp, LatestResults, FestivalsAndNews, Honours } from "@/components/home/HomeExtras";

export const runtime = "nodejs";
export const revalidate = 60;
// Title, description and card text come from the root layout; only the canonical URL is home-specific.
export const metadata = { alternates: { canonical: "/" } };

/* ---------- Types ---------- */
type LbRow = {
  position: number;
  player_id: string | null;
  display_name: string;
  total_points: number;
  events_played: number;
  wins?: number;
  is_anonymized: boolean;
  movement?: number;
};

type HomeResp = {
  ok: boolean;
  season_meta: { id: number; label: string; start_date: string; end_date: string; cap_x: number };
  leagues: { slug: string, label: string }[];
  leaderboards: Record<string, LbRow[]>;
  upcoming_events: Array<{ id: string; name: string; start_date: string }>;
  trending_players: Array<{ player_id: string; hits: number; display_name: string }>;
  biggest_gainers: Array<{ player_id: string; display_name: string; from_pos: number; to_pos: number; delta: number }>;
  prize_places: number | null;
};

/* ---------- Components ---------- */

function Hero({ seasonLabel, podium }: { seasonLabel: string; podium: LbRow[] }) {
  return (
    <section className="relative overflow-hidden border-b border-base-content/[0.07]">
      <div className="felt-glow pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-7xl gap-12 px-4 pb-16 pt-14 sm:px-6 md:pt-20 lg:grid-cols-12 lg:px-8">
        <div className="rise space-y-7 lg:col-span-7">
          <div className="eyebrow text-primary/90">{seasonLabel}</div>
          <h1 className="font-display text-5xl font-semibold leading-[0.98] tracking-[-0.035em] sm:text-6xl md:text-7xl">
            Every cash counts <span className="text-base-content/40">towards the</span> title.
          </h1>
          <p className="max-w-lg text-lg text-base-content/60">
            Standings, results and player records from the National Poker League and High Roller League.
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/leaderboards" className="btn btn-primary px-6 font-semibold">
              See the leaderboards
            </Link>
            <Link href="/events" className="group inline-flex items-center gap-1.5 text-sm font-medium text-base-content/75 hover:text-base-content">
              Browse tournaments
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>

        <div className="rise lg:col-span-5 [animation-delay:120ms]">
          <Podium rows={podium} />
        </div>
      </div>
    </section>
  );
}

/** Top three of the main league. */
function Podium({ rows }: { rows: LbRow[] }) {
  return (
    <div className="panel p-6">
      <div className="flex items-center justify-between">
        <div className="eyebrow">Current leaders</div>
        <Trophy size={16} className="text-primary" aria-hidden="true" />
      </div>

      {rows.length === 0 ? (
        <div className="py-10 text-center">
          <div className="font-display text-lg text-base-content/70">The table is empty</div>
          <p className="mt-1 text-sm text-base-content/40">Leaders show up once this season&apos;s first results are in.</p>
        </div>
      ) : (
        <ol className="mt-5 space-y-2">
          {rows.map((r, i) => (
            <li key={`${r.player_id}-${i}`}>
              <Link
                href={r.player_id ? `/players/${r.player_id}` : "/leaderboards"}
                className={`group flex items-center gap-4 rounded-xl px-4 transition-colors hover:bg-base-content/[0.04] ${
                  i === 0 ? "bg-primary/[0.07] py-4 ring-1 ring-inset ring-primary/20" : "py-3"
                }`}
              >
                <span className={`w-6 font-mono text-sm font-semibold ${i === 0 ? "text-primary" : "text-base-content/40"}`}>
                  {r.position}
                </span>
                <span className={`min-w-0 flex-1 truncate font-display font-medium group-hover:text-primary ${i === 0 ? "text-xl" : "text-base"}`}>
                  {r.display_name}
                </span>
                <span className="text-right">
                  <span className={`block font-mono font-semibold ${i === 0 ? "text-lg" : "text-sm"}`}>
                    {Number(r.total_points).toFixed(2)}
                  </span>
                  <span className="block text-[11px] text-base-content/40">pts</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function SideList({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="panel p-5">
      <h2 className="mb-4 flex items-center gap-2 font-display text-base font-semibold">
        <span className="text-primary" aria-hidden="true">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-base-content/40">{children}</p>;
}

function Unavailable() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="font-display text-2xl font-semibold">Leaderboards are unavailable</h1>
      <p className="mt-2 text-base-content/55">We couldn&apos;t load the latest results. Please try again in a minute.</p>
    </div>
  );
}

/* ---------- Page ---------- */
export default async function HomePage() {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const [res, extras] = await Promise.all([
    fetch(`${base}/api/home`, { cache: "no-store" }),
    getHomeExtras(),
  ]);

  if (!res.ok) return <Unavailable />;

  const data = (await res.json()) as HomeResp;

  if (!data || !data.ok || !data.leagues) return <Unavailable />;

  const mainLeagueSlug = data.leagues.find(l => l.slug === 'global' || l.slug === 'npl')?.slug || data.leagues[0]?.slug;

  const mainData = data.leaderboards?.[mainLeagueSlug] || [];
  const trendingPlayers = data.trending_players || [];
  const biggestGainers = data.biggest_gainers || [];
  // Same rule as the Standings page: the prize places, or the top 10 when no prizes are set.
  const paidPlaces = data.prize_places ?? 10;
  const lineRow = mainData.find((r) => r.position === paidPlaces);
  const bubblePlayers = mainData.filter((r) => r.position > paidPlaces && r.position <= paidPlaces + 5);

  return (
    <div className="flex flex-col">
      <Hero seasonLabel={data.season_meta?.label || "Current"} podium={mainData.slice(0, 3)} />
      <SeasonStrip extras={extras} />

      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <HomeLeaderboard
              leagues={data.leagues}
              leaderboards={data.leaderboards}
              seasonLabel={data.season_meta?.label || "Current season"}
              cap={data.season_meta?.cap_x || 0}
            />
          </div>

          <aside className="space-y-6 lg:col-span-4">
            <SideList title="Most viewed players" icon={<Eye size={16} />}>
              {trendingPlayers.length === 0 ? (
                <Empty>Nobody has been looked up yet.</Empty>
              ) : (
                <ol className="space-y-1">
                  {trendingPlayers.slice(0, 5).map((p, i) => (
                    <li key={p.player_id}>
                      <Link href={`/players/${p.player_id}`} className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-base-content/[0.04]">
                        <span className="w-5 font-mono text-xs text-base-content/35">{i + 1}</span>
                        <span className="truncate font-medium group-hover:text-primary">{p.display_name}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </SideList>

            <SideList title="Biggest climbers this week" icon={<TrendingUp size={16} />}>
              {biggestGainers.length === 0 ? (
                <Empty>No movement recorded yet.</Empty>
              ) : (
                <ul className="space-y-1">
                  {biggestGainers.slice(0, 5).map((g) => (
                    <li key={g.player_id}>
                      <Link href={`/players/${g.player_id}`} className="group -mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-base-content/[0.04]">
                        <span className="truncate font-medium group-hover:text-primary">{g.display_name}</span>
                        <span className="flex shrink-0 items-center gap-2 font-mono text-xs">
                          <span className="text-base-content/40">{g.from_pos}→{g.to_pos}</span>
                          <span className="rounded bg-success/15 px-1.5 py-0.5 font-semibold text-success">+{g.delta}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </SideList>

            <SideList title="On the bubble" icon={<CircleDot size={16} />}>
              <p className="-mt-2 mb-4 text-sm text-base-content/50">
                Just outside the {data.prize_places ? `prize places (top ${paidPlaces})` : `top ${paidPlaces}`}.
              </p>
              {bubblePlayers.length === 0 ? (
                <Empty>Not enough players ranked yet.</Empty>
              ) : (
                <ul className="divide-y divide-base-content/[0.06]">
                  {bubblePlayers.map((p) => (
                    <li key={p.position} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="w-7 font-mono text-xs text-warning">{p.position}</span>
                        {p.is_anonymized || !p.player_id ? (
                          <span className="truncate italic text-base-content/45">{p.display_name}</span>
                        ) : (
                          <Link href={`/players/${p.player_id}`} className="truncate hover:text-primary">{p.display_name}</Link>
                        )}
                      </span>
                      <span className="font-mono text-xs text-base-content/55">
                        {lineRow
                          ? `${(Number(lineRow.total_points) - Number(p.total_points)).toFixed(2)} short`
                          : Number(p.total_points).toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </SideList>
          </aside>
        </div>

        <div className="mt-16 space-y-16">
          <ComingUp extras={extras} />
          <LatestResults extras={extras} />
          <FestivalsAndNews extras={extras} />
          <Honours extras={extras} />
        </div>
      </div>
    </div>
  );
}
