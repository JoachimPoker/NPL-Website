import Link from "next/link";

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
  movement: number; // New field: +2, -1, 0, etc.
};

type HomeResp = {
  ok: true;
  season_meta: { id: number; label: string; start_date: string; end_date: string };
  leaderboards: { npl: LbRow[]; hrl: LbRow[] };
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
      <div className="absolute inset-0 bg-cover bg-right bg-no-repeat opacity-50" style={{ backgroundImage: 'url(/poker-hero.jpg)' }}></div>
      <div className="absolute inset-0 bg-gradient-to-r from-base-100 via-base-100/90 to-transparent"></div>
      <div className="relative z-10 mx-auto h-full max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col justify-center">
        <div className="max-w-xl space-y-6">
          <h1 className="text-5xl md:text-6xl font-black uppercase italic tracking-tighter text-white leading-[0.9]">
            The Future <br/> of Poker <span className="text-primary">Is Here.</span>
          </h1>
          <p className="text-lg text-base-content/80 font-medium">
            Join the National Poker League. Track your stats, climb the ranks, and compete for glory.
          </p>
          <div className="flex gap-4">
            <Link href="/signup" className="btn btn-primary btn-lg uppercase font-bold border-none">Join the League</Link>
            <Link href="/leaderboards" className="btn btn-outline btn-lg uppercase font-bold text-white hover:bg-white hover:text-black">View Standings</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper for Rank Movement Arrows
function RankMovement({ move }: { move: number }) {
  if (move > 0) return <span className="text-xs font-bold text-success flex items-center justify-center gap-0.5">▲ {move}</span>;
  if (move < 0) return <span className="text-xs font-bold text-error flex items-center justify-center gap-0.5">▼ {Math.abs(move)}</span>;
  return <span className="text-xs font-bold text-base-content/20 flex items-center justify-center">—</span>;
}

/* ---------- Page ---------- */
export default async function HomePage() {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/home`, { cache: "no-store" }); 
  
  if (!res.ok) return <div className="p-8 text-center">Failed to load data.</div>;
  const data = (await res.json()) as HomeResp;

  const nplTop = data.leaderboards.npl.slice(0, 18);
  const bubblePlayers = data.leaderboards.npl.slice(18, 23);

  return (
    <div className="flex flex-col min-h-screen">
      <AnnouncementBar />
      <Hero />

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN */}
          <div className="lg:col-span-8 space-y-8">
            <div className="card bg-base-100 shadow-xl border border-white/5">
              <div className="card-header p-6 border-b border-base-200 flex items-center justify-between">
                <div>
                   <h3 className="text-xl font-bold uppercase tracking-wide">🏆 Official Leaderboards</h3>
                   <div className="text-xs opacity-50 uppercase tracking-widest">{data.season_meta.label}</div>
                </div>
                <div className="tabs tabs-boxed bg-base-200">
                  <a className="tab tab-active text-xs font-bold uppercase">NPL</a>
                </div>
              </div>
              
              <div className="p-0 overflow-x-auto">
                <table className="table table-lg w-full">
                  <thead>
                    <tr className="bg-base-200/50 text-xs uppercase text-base-content/60">
                      <th className="w-20 text-center">Rank</th>
                      <th>Player</th>
                      <th className="text-right">Events</th>
                      <th className="text-right">Wins</th>
                      <th className="text-right">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nplTop.map((r) => (
                      <tr key={r.position} className="hover:bg-base-200/30 transition-colors border-b border-base-200/50">
                        <td className="text-center">
                          <div className="font-black text-xl italic text-base-content/40">{r.position}</div>
                          {/* MOVEMENT ARROW */}
                          <div className="mt-1"><RankMovement move={r.movement} /></div>
                        </td>
                        <td>
                          {r.is_anonymized || !r.player_id ? (
                             <div className="font-bold text-lg text-white/50 italic flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-base-300 flex items-center justify-center text-xs font-bold text-base-content/30">🔒</div>
                                {r.display_name}
                             </div>
                          ) : (
                             <Link href={`/players/${r.player_id}`} className="font-bold text-lg hover:text-primary transition-colors flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-base-300 flex items-center justify-center text-xs font-bold text-base-content/50">
                                  {r.display_name.charAt(0)}
                                </div>
                                {r.display_name}
                             </Link>
                          )}
                        </td>
                        <td className="text-right font-mono text-base-content/70">{r.events_played}</td>
                        <td className="text-right font-mono text-base-content/70">{r.wins ?? 0}</td>
                        <td className="text-right font-black text-primary text-lg">{Number(r.total_points).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 border-t border-base-200 text-center">
                <Link href="/leaderboards" className="btn btn-ghost btn-sm uppercase text-xs tracking-widest">
                  View Full Leaderboard →
                </Link>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Trending Players */}
            <div className="card bg-base-100 shadow-lg border border-white/5 p-5">
              <h4 className="text-sm font-bold uppercase tracking-widest text-base-content/50 mb-4 flex items-center gap-2">
                🔥 Trending Players
              </h4>
              <ul className="space-y-3">
                {data.trending_players.slice(0, 5).map((p, i) => (
                  <li key={p.player_id} className="flex items-center justify-between group cursor-pointer">
                    <Link href={`/players/${p.player_id}`} className="flex items-center gap-3">
                      <span className="text-lg font-black text-base-content/20 group-hover:text-primary transition-colors">0{i+1}</span>
                      <span className="font-semibold group-hover:text-primary transition-colors">{p.display_name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* RESTORED: Biggest Gainers */}
            <div className="card bg-base-100 shadow-lg border border-white/5 p-5">
              <h4 className="text-sm font-bold uppercase tracking-widest text-base-content/50 mb-4 flex items-center gap-2">
                🚀 Biggest Movers (Week)
              </h4>
              <ul className="space-y-3">
                {data.biggest_gainers.length === 0 ? (
                  <div className="text-sm text-base-content/40 italic">No movement recorded yet.</div>
                ) : (
                  data.biggest_gainers.slice(0, 5).map((g) => (
                    <li key={g.player_id} className="flex items-center justify-between">
                      <Link href={`/players/${g.player_id}`} className="font-semibold hover:text-primary truncate max-w-[150px]">
                        {g.display_name}
                      </Link>
                      <div className="flex items-center gap-2">
                         {/* Show rank change: e.g. #25 -> #20 */}
                        <span className="text-xs text-base-content/40">#{g.from_pos} → #{g.to_pos}</span>
                        <span className="badge badge-success badge-sm font-bold text-white">+{g.delta}</span>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>

            {/* Bubble Watch */}
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
                      <span className="font-mono opacity-60">{Number(p.total_points).toFixed(1)}</span>
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