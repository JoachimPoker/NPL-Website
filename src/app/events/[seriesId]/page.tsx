import { createSupabaseServerClient } from "@/lib/supabaseServer";
import Link from "next/link";

export const runtime = "nodejs";
export const revalidate = 60;

/* ---------- Types ---------- */
type LbRow = {
  position: number;
  player_id: string;
  display_name: string;
  total_points: number;
  events_played: number;
  wins: number;
  final_tables: number;
};

/* ---------- Helpers ---------- */
function getProgress(start?: string, end?: string) {
  if (!start || !end) return 0;
  const now = new Date().getTime();
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (now < s) return 0;
  if (now > e) return 100;
  return Math.min(100, Math.max(0, ((now - s) / (e - s)) * 100));
}

function getSeriesStatus(start?: string, end?: string) {
  if (!start || !end) return { label: "Unknown", color: "badge-ghost" };
  const now = new Date().getTime();
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  
  if (now < s) return { label: "Upcoming", color: "badge-warning" };
  if (now > e) return { label: "Completed", color: "badge-ghost opacity-50" };
  return { label: "Live Now", color: "badge-error animate-pulse" };
}

/* ---------- Page Component ---------- */
export default async function SeriesPage(props: {
  params: Promise<{ seriesId: string }>;
  searchParams: Promise<{ scope?: string; page?: string }>;
}) {
  const params = await props.params;
  const sp = await props.searchParams;
  
  const seriesId = Number(params.seriesId);
  // Default to 'season' if not specified
  const scope = sp.scope === "all_time" ? "all_time" : "season";
  const currentPage = Number(sp.page || 1);
  const pageSize = 50;

  const supabase = await createSupabaseServerClient();

  // 1. Fetch Series Info
  const { data: series } = await supabase
    .from("series")
    .select("id, name")
    .eq("id", seriesId)
    .single();

  // 2. Fetch Date Range (for progress bar)
  const { data: dateRange } = await supabase
    .from("events")
    .select("start_date")
    .eq("series_id", seriesId)
    .order("start_date", { ascending: true });
  
  const startDate = dateRange?.[0]?.start_date;
  const endDate = dateRange?.[dateRange.length - 1]?.start_date;
  const progress = getProgress(startDate, endDate);
  const status = getSeriesStatus(startDate, endDate);

  // 3. Fetch Recent Champions (Most recent 4 winners)
  const { data: recentWinners } = await supabase
    .from("results")
    .select("points, event:events!inner(name, start_date, series_id), player:players(id, display_name, forename, surname)")
    .eq("events.series_id", seriesId)
    .eq("position_of_prize", 1)
    .eq("is_deleted", false)
    .order("event(start_date)", { ascending: false })
    .limit(4);

  // 4. Fetch Leaderboard (Using SCOPE instead of LEAGUE)
  const { data: rawRows, error: lbError } = await supabase.rpc("leaderboard_for_series", {
    p_series_id: seriesId,
    p_scope: scope, 
  });

  if (lbError) console.error("Leaderboard Error:", lbError);
  const allRows: LbRow[] = rawRows || [];

  // Stats Calculations
  const mostWins = [...allRows].sort((a, b) => b.wins - a.wins)[0];
  const mostFts = [...allRows].sort((a, b) => b.final_tables - a.final_tables)[0];
  const mostEvents = [...allRows].sort((a, b) => b.events_played - a.events_played)[0];

  // Pagination
  const totalPlayers = allRows.length;
  const totalPages = Math.ceil(totalPlayers / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedRows = allRows.slice(startIndex, startIndex + pageSize);

  // 5. Fetch Festivals
  const { data: festivals } = await supabase
    .from("festivals")
    .select("id, label, start_date, end_date")
    .eq("series_id", seriesId)
    .order("start_date", { ascending: true });

  return (
    <div className="container mx-auto max-w-7xl space-y-10 py-8 px-4">
      {/* Header with Progress Bar */}
      <div className="flex flex-col gap-6 border-b border-white/5 pb-8">
        <div className="flex flex-col md:flex-row items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`badge ${status.color} font-bold uppercase tracking-widest text-xs`}>{status.label}</span>
              <span className="text-xs font-bold uppercase tracking-widest text-primary">Tournament Series</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter text-white">
              {series?.name || `Series #${seriesId}`}
            </h1>
          </div>
          
          {/* SCOPE TOGGLE (Season vs All-Time) */}
          <div className="flex items-center gap-2 bg-base-200/50 p-1 rounded-lg border border-white/5">
             <Link 
               href={`?scope=season`} 
               className={`btn btn-sm ${scope === 'season' ? 'btn-primary' : 'btn-ghost'} uppercase font-bold`}
             >
               Current Season
             </Link>
             <Link 
               href={`?scope=all_time`} 
               className={`btn btn-sm ${scope === 'all_time' ? 'btn-secondary' : 'btn-ghost'} uppercase font-bold`}
             >
               All-Time
             </Link>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full space-y-2">
          <div className="flex justify-between text-xs font-mono opacity-50 uppercase">
            <span>Start: {startDate ? new Date(startDate).toLocaleDateString() : 'TBA'}</span>
            <span>{Math.round(progress)}% Complete</span>
            <span>End: {endDate ? new Date(endDate).toLocaleDateString() : 'TBA'}</span>
          </div>
          <progress className="progress progress-primary w-full h-3" value={progress} max="100"></progress>
        </div>
      </div>

      {/* "Wall of Champions" */}
      {recentWinners && recentWinners.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🔥</span>
            <h3 className="text-lg font-bold uppercase tracking-widest text-white">Latest Champions</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recentWinners.map((w: any, i: number) => {
              // @ts-ignore
              const pName = w.player?.display_name || `${w.player?.forename} ${w.player?.surname}`;
              return (
                <div key={i} className="card bg-gradient-to-br from-base-100 to-base-200 border border-white/10 hover:border-warning/50 transition-all group">
                  <div className="card-body p-5">
                    <div className="text-xs font-bold text-warning uppercase tracking-wider mb-1">Winner</div>
                    <div className="font-black text-lg text-white truncate group-hover:text-warning transition-colors">
                      {pName}
                    </div>
                    <div className="text-xs opacity-60 mt-2 line-clamp-1" title={w.event?.name}>
                      {w.event?.name}
                    </div>
                    <div className="text-xs font-mono opacity-40 mt-1">
                      {new Date(w.event?.start_date).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Main Stats Grid */}
      {allRows.length > 0 && (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard label="Most Wins" value={mostWins?.wins || 0} player={mostWins?.display_name} icon="🏆" color="text-warning" />
          <StatCard label="Most Final Tables" value={mostFts?.final_tables || 0} player={mostFts?.display_name} icon="⚡" color="text-primary" />
          <StatCard label="Most Cashes" value={mostEvents?.events_played || 0} player={mostEvents?.display_name} icon="💰" color="text-success" />
        </section>
      )}

      {/* Leaderboard Table */}
      <section className="card bg-base-100 shadow-xl border border-white/5 overflow-hidden">
        <div className="card-header p-6 border-b border-white/5 bg-base-200/20 flex justify-between items-center">
          <h3 className="text-xl font-bold uppercase tracking-wide">
            {scope === 'season' ? 'Current Season' : 'All-Time'} Standings
          </h3>
          <span className="text-xs font-bold uppercase text-base-content/40 tracking-widest">
            {totalPlayers} Players
          </span>
        </div>
        
        <div className="card-body p-0">
          <div className="overflow-x-auto">
            {!paginatedRows.length ? (
              <div className="p-12 text-center text-base-content/50 italic">
                {scope === 'season' 
                  ? "No results recorded for the active season yet." 
                  : "No results recorded for this series yet."}
              </div>
            ) : (
              <table className="table table-lg w-full">
                <thead>
                  <tr className="bg-base-200/50 text-xs uppercase text-base-content/60 border-b border-white/5">
                    <th className="w-20 text-center">Rank</th>
                    <th>Player</th>
                    <th className="text-right">Total Pts</th>
                    <th className="text-right">Events</th>
                    <th className="text-right hidden sm:table-cell">Wins</th>
                    <th className="text-right hidden sm:table-cell">FTs</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((r) => (
                    <tr key={r.player_id} className={`hover:bg-base-200/30 transition-colors border-b border-base-200/50 last:border-0 ${r.position <= 3 ? 'bg-white/5' : ''}`}>
                      <td className="text-center">
                        {r.position === 1 && <div className="text-2xl">🥇</div>}
                        {r.position === 2 && <div className="text-2xl">🥈</div>}
                        {r.position === 3 && <div className="text-2xl">🥉</div>}
                        {r.position > 3 && <span className="font-mono font-bold opacity-50 text-xl italic">{r.position}</span>}
                      </td>
                      <td>
                        <Link className="font-bold text-lg hover:text-primary transition-colors" href={`/players/${encodeURIComponent(r.player_id)}`}>
                          {r.display_name}
                        </Link>
                      </td>
                      <td className="text-right font-black text-primary text-lg">
                        {Number(r.total_points).toFixed(2)}
                      </td>
                      <td className="text-right font-mono opacity-80">
                        {r.events_played}
                      </td>
                      <td className="text-right font-bold text-warning hidden sm:table-cell">
                        {r.wins > 0 ? r.wins : '-'}
                      </td>
                      <td className="text-right font-mono opacity-60 hidden sm:table-cell">
                        {r.final_tables > 0 ? r.final_tables : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="card-footer p-4 border-t border-white/5 bg-base-200/20 flex justify-between items-center">
             <div className="text-xs text-base-content/50">Page {currentPage} of {totalPages}</div>
             <div className="join">
                <Link href={`?scope=${scope}&page=${currentPage - 1}`} className={`join-item btn btn-sm ${currentPage <= 1 ? "btn-disabled" : "btn-outline"}`}>« Prev</Link>
                <Link href={`?scope=${scope}&page=${currentPage + 1}`} className={`join-item btn btn-sm ${currentPage >= totalPages ? "btn-disabled" : "btn-outline"}`}>Next »</Link>
             </div>
          </div>
        )}
      </section>

      {/* Festivals List */}
      {festivals && festivals.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-6 border-l-4 border-primary pl-4">
             <h3 className="text-2xl font-bold uppercase italic tracking-tight text-white">Festivals</h3>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {festivals.map((f) => (
              <Link 
                key={f.id}
                href={`/events/${encodeURIComponent(params.seriesId)}/${encodeURIComponent(f.id)}`}
                className="card bg-base-100 shadow-lg border border-white/5 hover:border-primary/50 hover:-translate-y-1 transition-all group"
              >
                <div className="card-body">
                  <div className="flex justify-between">
                    <div className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-1">Festival</div>
                    {getSeriesStatus(f.start_date, f.end_date).label === 'Live Now' && <span className="badge badge-error badge-xs animate-pulse">LIVE</span>}
                  </div>
                  <h4 className="card-title text-lg font-bold group-hover:text-primary transition-colors">{f.label}</h4>
                  <div className="mt-4 flex items-center justify-between text-xs text-base-content/60 font-mono">
                    <span>{f.start_date ? new Date(f.start_date).toLocaleDateString() : "TBA"}</span>
                    <span>→</span>
                    <span>{f.end_date ? new Date(f.end_date).toLocaleDateString() : "TBA"}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value, player, icon, color }: { label: string; value: number; player?: string; icon: string; color: string }) {
  if (!player || value === 0) return null;
  return (
    <div className="card bg-base-100 shadow-md border border-white/5 p-4 flex flex-row items-center gap-4">
      <div className="text-3xl grayscale opacity-80">{icon}</div>
      <div>
        <div className="text-xs font-bold uppercase tracking-widest text-base-content/50">{label}</div>
        <div className={`text-2xl font-black ${color}`}>{value}</div>
        <div className="text-sm font-bold text-white truncate max-w-[150px]">{player}</div>
      </div>
    </div>
  );
}