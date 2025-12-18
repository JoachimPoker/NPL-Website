import Link from "next/link";
import HomeLeaderboard from "@/components/HomeLeaderboard";

export const runtime = "nodejs";
export const revalidate = 60; 

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
  ok: boolean; // Changed to boolean to allow false checks
  season_meta: { id: number; label: string; start_date: string; end_date: string; cap_x: number };
  leagues: { slug: string, label: string }[];
  leaderboards: Record<string, LbRow[]>; 
  upcoming_events: Array<{ id: string; name: string; start_date: string }>;
  trending_players: Array<{ player_id: string; hits: number; display_name: string }>;
  biggest_gainers: Array<{ player_id: string; display_name: string; from_pos: number; to_pos: number; delta: number }>;
};

/* ---------- Components ---------- */

function AnnouncementBar() {
  return (
    <div className="w-full bg-base-300 border-b border-base-content/5 py-1.5 overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-base-content/70">
        <span>📢 Next Event: GUKPT Leeds — Starts Next Thursday</span>
        <span className="hidden sm:inline">🏆 Rankings Updated Daily</span>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <div className="relative w-full h-[400px] bg-neutral overflow-hidden">
      <div 
        className="absolute inset-0 bg-cover bg-right bg-no-repeat opacity-50"
        style={{ backgroundImage: 'url(/poker-hero.jpg)' }} 
      ></div>
      <div className="absolute inset-0 bg-gradient-to-r from-base-100 via-base-100/90 to-transparent"></div>

      <div className="relative z-10 mx-auto h-full max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col justify-center">
        <div className="max-w-xl space-y-6">
          <div className="inline-block px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest">
            Unofficial Fan Site
          </div>
          <h1 className="text-5xl md:text-6xl font-black uppercase italic tracking-tighter text-white leading-[0.9]">
            The Future <br/> of Poker <span className="text-primary">Is Here.</span>
          </h1>
          <p className="text-lg text-base-content/80 font-medium">
            Join the National Poker League. Track your stats, climb the ranks, and compete for glory.
          </p>
          <div className="flex gap-4">
            <Link href="/signup" className="btn btn-primary btn-lg uppercase font-bold border-none">
              Join the League
            </Link>
            <Link href="/leaderboards" className="btn btn-outline btn-lg uppercase font-bold text-white hover:bg-white hover:text-black">
              View Standings
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Page ---------- */
export default async function HomePage() {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/home`, { cache: "no-store" }); 
  
  if (!res.ok) return <div className="p-8 text-center">Failed to load data.</div>;
  
  const data = (await res.json()) as HomeResp;

  // SAFETY CHECK: Ensure data structure exists before accessing properties
  if (!data || !data.ok || !data.leagues) {
     return <div className="p-10 text-center">Leaderboard service unavailable.</div>;
  }

  const mainLeagueSlug = data.leagues.find(l => l.slug === 'global' || l.slug === 'npl')?.slug || data.leagues[0]?.slug;
  
  // Use optional chaining and default empty arrays for safety
  const mainData = data.leaderboards?.[mainLeagueSlug] || [];
  const trendingPlayers = data.trending_players || [];
  const biggestGainers = data.biggest_gainers || [];
  const bubblePlayers = mainData.slice(18, 23);

  return (
    <div className="flex flex-col min-h-screen">
      <AnnouncementBar />
      <Hero />

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          <div className="lg:col-span-8 space-y-8">
            <HomeLeaderboard 
                leagues={data.leagues}
                leaderboards={data.leaderboards} 
                seasonLabel={data.season_meta?.label || "Current Season"}
                cap={data.season_meta?.cap_x || 0}
            />
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="card bg-base-100 shadow-lg border border-white/5 p-5">
              <h4 className="text-sm font-bold uppercase tracking-widest text-base-content/50 mb-4 flex items-center gap-2">
                🔥 Trending Players
              </h4>
              <ul className="space-y-3">
                {trendingPlayers.slice(0, 5).map((p, i) => (
                  <li key={p.player_id} className="flex items-center justify-between group cursor-pointer">
                    <Link href={`/players/${p.player_id}`} className="flex items-center gap-3">
                      <span className="text-lg font-black text-base-content/20 group-hover:text-primary transition-colors">0{i+1}</span>
                      <span className="font-semibold group-hover:text-primary transition-colors">{p.display_name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card bg-base-100 shadow-lg border border-white/5 p-5">
              <h4 className="text-sm font-bold uppercase tracking-widest text-base-content/50 mb-4 flex items-center gap-2">
                🚀 Biggest Movers (Week)
              </h4>
              <ul className="space-y-3">
                {biggestGainers.length === 0 ? (
                  <div className="text-sm text-base-content/40 italic">No movement recorded yet.</div>
                ) : (
                  biggestGainers.slice(0, 5).map((g) => (
                    <li key={g.player_id} className="flex items-center justify-between">
                      <Link href={`/players/${g.player_id}`} className="font-semibold hover:text-primary truncate max-w-[150px]">
                        {g.display_name}
                      </Link>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-base-content/40">#{g.from_pos} → #{g.to_pos}</span>
                        <span className="badge badge-success badge-sm font-bold text-white">+{g.delta}</span>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>

            <div className="card bg-warning/10 shadow-lg border border-warning/20 p-5">
              <h4 className="text-sm font-bold uppercase tracking-widest text-warning mb-4 flex items-center gap-2">
                ⚠️ The Bubble Watch
              </h4>
              <p className="text-xs text-base-content/60 mb-4">
                Players ranked 19-23, fighting to break into the Top 18 prize zone.
              </p>
              <ul className="space-y-2">
                {bubblePlayers.length === 0 ? (
                  <div className="text-sm opacity-50">Not enough data yet.</div>
                ) : (
                  bubblePlayers.map((p) => (
                    <li key={p.position} className="flex justify-between items-center text-sm border-b border-warning/10 pb-1 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-warning font-bold w-6">#{p.position}</span>
                         {p.is_anonymized ? (
                            <span className="opacity-60 italic">{p.display_name}</span>
                         ) : (
                            <Link href={`/players/${p.player_id}`} className="hover:text-warning transition-colors">{p.display_name}</Link>
                         )}
                      </div>
                      <span className="font-mono opacity-60 font-bold">{Number(p.total_points).toFixed(1)}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}