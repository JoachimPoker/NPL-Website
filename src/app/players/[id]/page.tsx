import Link from "next/link";
import { getPlayerProfile } from "@/lib/data";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import PlayerPointsChart from "@/components/PlayerPointsChart";

const PLACEHOLDER_AVATAR_URL = "/avatar-default.svg";

export const runtime = "nodejs";
export const revalidate = 60;

export default async function PlayerProfile(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params;

  // 1. TRACKING
  const supabase = await createSupabaseServerClient();
  try {
    await supabase.from("player_searches").insert({ player_id: id });
  } catch (e) { /* ignore */ }

  // 2. FETCH DATA
  const data = await getPlayerProfile(id);

  if (!data) {
    return (
      <div className="container mx-auto p-12 text-center space-y-4">
        <h1 className="text-2xl font-bold uppercase tracking-widest text-base-content/50">Player Not Found</h1>
        <Link href="/players" className="btn btn-outline btn-sm uppercase">Return to List</Link>
      </div>
    );
  }

  const { player: p, stats, recent_results, graph_data } = data;

  return (
    <div className="min-h-screen bg-base-200/50 pb-12">
      
      {/* --- HEADER SECTION --- */}
      <div className="bg-base-100 border-b border-white/5">
        <div className="container mx-auto max-w-7xl px-4 py-8 md:py-12">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-8">
            
            {/* AVATAR */}
            <div className="relative">
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-xl overflow-hidden ring-4 ring-base-100 shadow-2xl bg-base-300">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={p.avatar_url || PLACEHOLDER_AVATAR_URL} 
                  alt={p.name} 
                  className="w-full h-full object-cover"
                />
              </div>
              {stats.current_rank && stats.current_rank <= 3 && (
                <div className="absolute -top-4 -right-4 w-12 h-12 bg-primary text-primary-content rounded-full flex items-center justify-center font-black text-xl shadow-lg border-4 border-base-100">
                  #{stats.current_rank}
                </div>
              )}
            </div>

            {/* IDENTITY */}
            <div className="flex-1 text-center md:text-left space-y-1">
              <div className="text-xs font-bold uppercase tracking-widest text-primary mb-1">
                National Poker League
              </div>
              <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter text-white leading-none">
                {p.name}
              </h1>
              <div className="flex flex-wrap justify-center md:justify-start gap-3 pt-3">
                {stats.current_rank ? (
                  <div className="badge badge-lg badge-neutral border-primary/20 text-primary font-bold uppercase text-xs tracking-wider">
                    Rank #{stats.current_rank}
                  </div>
                ) : (
                  <div className="badge badge-lg badge-ghost opacity-50 font-bold uppercase text-xs tracking-wider">
                    Unranked
                  </div>
                )}
                {p.consent && (
                  <div className="badge badge-lg badge-ghost border-white/10 font-bold uppercase text-xs tracking-wider gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-success"></span> Verified Profile
                  </div>
                )}
              </div>
            </div>

            {/* KEY METRICS (Desktop) */}
            <div className="hidden md:flex gap-8 text-right">
              <div>
                <div className="text-[10px] font-bold uppercase text-base-content/40 tracking-widest">Total Points</div>
                <div className="text-3xl font-black text-primary">{stats.lifetime_points.toFixed(0)}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase text-base-content/40 tracking-widest">Winnings</div>
                <div className="text-3xl font-black text-white">£{stats.total_earnings.toLocaleString()}</div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* --- MAIN CONTENT --- */}
      <div className="container mx-auto max-w-7xl px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: Stats & Graph */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Mobile Metrics (Visible only on small screens) */}
          <div className="grid grid-cols-2 gap-4 md:hidden">
            <div className="card bg-base-100 p-4 border border-white/5 text-center">
               <div className="text-[10px] font-bold uppercase text-base-content/40 tracking-widest">Points</div>
               <div className="text-2xl font-black text-primary">{stats.lifetime_points.toFixed(0)}</div>
            </div>
            <div className="card bg-base-100 p-4 border border-white/5 text-center">
               <div className="text-[10px] font-bold uppercase text-base-content/40 tracking-widest">Winnings</div>
               <div className="text-2xl font-black text-white">£{stats.total_earnings.toLocaleString()}</div>
            </div>
          </div>

          {/* Performance Graph */}
          <div className="card bg-base-100 shadow-xl border border-white/5">
            <div className="p-6 border-b border-white/5 flex justify-between items-center">
              <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                📈 Season Trajectory
              </h3>
            </div>
            <div className="p-6">
              <PlayerPointsChart data={graph_data} />
            </div>
          </div>

          {/* Recent Results */}
          <div className="card bg-base-100 shadow-xl border border-white/5 overflow-hidden">
            <div className="p-6 border-b border-white/5 flex justify-between items-end">
              <div>
                <h3 className="text-lg font-bold uppercase tracking-wide text-white">Recent Cashes</h3>
                <p className="text-xs text-base-content/50 mt-1">Performance in last 50 events</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="table table-sm w-full">
                <thead>
                  <tr className="bg-base-200/50 text-[10px] uppercase text-base-content/60 border-b border-white/5">
                    <th className="py-3 pl-6">Date</th>
                    <th className="py-3">Event</th>
                    <th className="py-3 text-right">Pos</th>
                    <th className="py-3 text-right">Points</th>
                    <th className="py-3 text-right pr-6">Prize</th>
                  </tr>
                </thead>
                <tbody>
                  {recent_results.map((r) => {
                    const isWin = r.position_of_prize === 1;
                    const isCash = r.prize_amount && Number(r.prize_amount) > 0;
                    return (
                      <tr key={r.id} className="hover:bg-base-200/30 transition-colors border-b border-base-200/50 last:border-0">
                        <td className="pl-6 font-mono text-xs opacity-50">
                          {r.event?.start_date ? new Date(r.event.start_date).toLocaleDateString("en-GB") : "-"}
                        </td>
                        <td>
                          <div className="font-bold text-sm text-base-content/90">{r.event?.name}</div>
                          <div className="text-[10px] opacity-50 uppercase tracking-wide">{r.event?.site_name}</div>
                        </td>
                        <td className="text-right">
                          {isWin ? (
                            <span className="badge badge-warning badge-xs font-bold text-black">1st</span>
                          ) : (
                            <span className="font-mono text-xs font-bold text-base-content/70">{r.position_of_prize ? `#${r.position_of_prize}` : "-"}</span>
                          )}
                        </td>
                        <td className="text-right font-mono text-sm font-bold text-primary">
                          {Number(r.points).toFixed(0)}
                        </td>
                        <td className="text-right pr-6 font-mono text-xs text-base-content/60">
                          {isCash ? `£${Number(r.prize_amount).toLocaleString()}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                  {!recent_results.length && (
                    <tr><td colSpan={5} className="text-center py-8 text-sm opacity-50">No recent results found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Sidebar Stats */}
        <div className="space-y-6">
          
          <div className="card bg-base-100 shadow-xl border border-white/5 p-6">
            <h4 className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-6">Career Stats</h4>
            
            <div className="space-y-6">
              <div className="flex justify-between items-center border-b border-white/5 pb-3 last:border-0">
                <span className="text-sm font-medium text-base-content/70">Events Played</span>
                <span className="text-xl font-bold text-white">{stats.results_count}</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/5 pb-3 last:border-0">
                <span className="text-sm font-medium text-base-content/70">Total Wins</span>
                <span className="text-xl font-bold text-white">{stats.total_wins}</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/5 pb-3 last:border-0">
                <span className="text-sm font-medium text-base-content/70">Win Rate</span>
                <span className="text-xl font-bold text-white">
                  {stats.results_count ? ((stats.total_wins / stats.results_count) * 100).toFixed(1) : 0}%
                </span>
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-primary/10 to-base-100 border border-primary/20 p-6">
            <h4 className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Claim This Profile</h4>
            <p className="text-xs text-base-content/70 mb-4">
              Is this you? Link your account to track your progress and upload your own photo.
            </p>
            <Link href="/signup" className="btn btn-primary btn-sm w-full uppercase font-bold tracking-widest">
              Claim Profile
            </Link>
          </div>

        </div>

      </div>
    </div>
  );
}