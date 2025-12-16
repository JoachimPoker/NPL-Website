import { createSupabaseServerClient } from "@/lib/supabaseServer";
import Link from "next/link";
import { redirect } from "next/navigation";

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
  bonus_points?: number; // Optional, only exists for seasonal
};

/* ---------- Page Component ---------- */
export default async function LeaderboardsPage(props: {
  searchParams: Promise<{ season?: string; league?: string; page?: string }>;
}) {
  const sp = await props.searchParams;
  const currentPage = Number(sp.page || 1);
  const pageSize = 50;

  const supabase = await createSupabaseServerClient();

  // 1. Fetch All Seasons (for the dropdown)
  const { data: allSeasons } = await supabase
    .from("seasons")
    .select("id, label, is_active")
    .order("start_date", { ascending: false });

  // 2. Determine Scope (All-Time vs Specific Season)
  // If no params, default to active season. If no active season, default to "all-time".
  const activeSeason = allSeasons?.find(s => s.is_active);
  const targetSeasonId = sp.season || (activeSeason ? String(activeSeason.id) : "all-time");
  const isAllTime = targetSeasonId === "all-time";

  // 3. Variables for view logic
  let tabs: { label: string; slug: string; id?: number }[] = [];
  let currentTabSlug = "";
  let pageTitle = "";
  let pageSubtitle = "";
  let ruleDescription = "";
  let allRows: LbRow[] = [];

  // --- BRANCH A: ALL-TIME VIEW ---
  if (isAllTime) {
    pageTitle = "All-Time Records";
    pageSubtitle = "NPL History";
    ruleDescription = "Cumulative Total";
    
    // Hardcoded tabs for All-Time
    tabs = [
      { label: "National Poker League", slug: "npl" },
      { label: "High Roller", slug: "hr" }
    ];
    
    currentTabSlug = sp.league || "global";
    
    // Call All-Time SQL
    const isHighRoller = currentTabSlug === "hr" ? true : null;
    const { data, error } = await supabase.rpc("get_all_time_leaderboard", {
      p_filter_hr: isHighRoller
    });
    if (error) console.error("All-Time Error:", error);
    allRows = data || [];
  } 

  // --- BRANCH B: SEASONAL VIEW ---
  else {
    // Fetch full details for the selected season
    const { data: seasonData } = await supabase
      .from("seasons")
      .select(`
        id, label,
        leagues (id, label, slug, scoring_method, scoring_cap, league_bonuses(bonus_type, points_value))
      `)
      .eq("id", targetSeasonId)
      .single();

    if (seasonData) {
      pageTitle = seasonData.label;
      pageSubtitle = "Season Standings";
      
      // Sort leagues by ID
      const leagues = seasonData.leagues || [];
      leagues.sort((a, b) => a.id - b.id);
      
      tabs = leagues.map(l => ({ label: l.label, slug: l.slug, id: l.id }));
      
      // Determine active league tab
      currentTabSlug = sp.league || tabs[0]?.slug || "";
      const currentLeague = leagues.find(l => l.slug === currentTabSlug) || leagues[0];

      if (currentLeague) {
        // Set Rule Description
        ruleDescription = currentLeague.scoring_method === 'capped' 
          ? `Best ${currentLeague.scoring_cap} Results` 
          : 'Total Accumulator';
          
        if (currentLeague.league_bonuses?.length > 0) ruleDescription += " + Bonuses";

        // Call League SQL
        const { data, error } = await supabase.rpc("get_league_leaderboard", {
          p_league_id: currentLeague.id
        });
        if (error) console.error("League Error:", error);
        allRows = data || [];
      }
    } else {
      // Fallback if season ID is invalid
      return <div className="p-12 text-center">Season not found.</div>;
    }
  }

  /* --- Common Logic: Stats & Pagination --- */
  const totalPlayers = allRows.length;
  const leader = allRows[0];
  const mostWins = [...allRows].sort((a, b) => b.wins - a.wins)[0];
  const mostFts = [...allRows].sort((a, b) => b.final_tables - a.final_tables)[0];

  const totalPages = Math.ceil(totalPlayers / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedRows = allRows.slice(startIndex, startIndex + pageSize);

  return (
    <div className="container mx-auto max-w-7xl space-y-10 py-8 px-4">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col gap-6 border-b border-white/5 pb-8">
        
        {/* Top Row: Subtitle & Season Selector */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="text-xs font-bold uppercase tracking-widest text-primary">
            {pageSubtitle}
          </div>

          {/* SEASON SELECTOR DROPDOWN */}
          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-sm btn-outline uppercase font-bold min-w-[160px] justify-between">
              {isAllTime ? "All-Time" : pageTitle}
              <span className="text-xs opacity-50">▼</span>
            </div>
            <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow-2xl bg-base-100 rounded-box w-52 border border-white/10">
              {/* Active/Past Seasons */}
              {allSeasons?.map(s => (
                <li key={s.id}>
                  <Link 
                    href={`?season=${s.id}`} 
                    className={`uppercase font-bold text-xs py-3 ${String(s.id) === targetSeasonId ? "text-primary active" : ""}`}
                  >
                    {s.label} {s.is_active && <span className="badge badge-xs badge-success ml-auto">Active</span>}
                  </Link>
                </li>
              ))}
              <div className="divider my-1 opacity-10"></div>
              {/* All-Time Option */}
              <li>
                <Link 
                  href="?season=all-time" 
                  className={`uppercase font-bold text-xs py-3 ${isAllTime ? "text-primary active" : ""}`}
                >
                  All-Time Records
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Title & Rules */}
        <div>
          <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter text-white">
            {isAllTime ? (currentTabSlug === 'hr' ? 'High Roller' : 'Global Rankings') : (tabs.find(t => t.slug === currentTabSlug)?.label || pageTitle)}
          </h1>
          
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-base-200/50 border border-white/10">
             <span className={`w-2 h-2 rounded-full ${isAllTime ? 'bg-secondary' : 'bg-success animate-pulse'}`}></span>
             <span className="text-xs font-mono font-bold text-base-content/70 uppercase">
               {ruleDescription}
             </span>
          </div>
        </div>

        {/* TABS */}
        <div className="tabs tabs-boxed bg-base-200/50 p-1.5 rounded-xl border border-white/5 w-fit">
          {tabs.map(t => (
            <Link 
              key={t.slug} 
              href={`?season=${targetSeasonId}&league=${t.slug}`}
              className={`tab tab-lg ${currentTabSlug === t.slug ? 'tab-active bg-primary text-primary-content font-bold shadow-md' : 'hover:bg-white/5'}`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>

      {/* HIGHLIGHTS (STAT CARDS) */}
      {allRows.length > 0 && (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard 
            label="Leader" 
            value={Number(leader?.total_points).toFixed(0)} 
            subValue="Points"
            player={leader?.display_name} 
            rank="#1"
            color="from-primary/20 to-base-100"
          />
           <StatCard 
            label="Most Wins" 
            value={mostWins?.wins || 0} 
            subValue="Wins"
            player={mostWins?.display_name} 
            icon="🏆"
            color="bg-base-100"
          />
           <StatCard 
            label="Final Tables" 
            value={mostFts?.final_tables || 0} 
            subValue="FTs"
            player={mostFts?.display_name} 
            icon="⚡"
            color="bg-base-100"
          />
        </section>
      )}

      {/* MAIN TABLE */}
      <section className="card bg-base-100 shadow-2xl border border-white/5 overflow-hidden">
        <div className="card-header p-6 border-b border-white/5 bg-base-200/20 flex justify-between items-center">
          <h3 className="text-xl font-bold uppercase tracking-wide">Standings</h3>
          <span className="badge badge-outline font-mono text-xs opacity-50">
            {totalPlayers} Players
          </span>
        </div>

        <div className="p-0 overflow-x-auto">
          {!paginatedRows.length ? (
            <div className="p-16 text-center">
              <div className="text-2xl opacity-20 mb-2">∅</div>
              <div className="text-base-content/50 italic">No rankings available.</div>
            </div>
          ) : (
            <table className="table table-lg w-full">
              <thead>
                <tr className="bg-base-200/50 text-xs uppercase text-base-content/60 border-b border-white/5">
                  <th className="w-24 text-center">Rank</th>
                  <th>Player</th>
                  <th className="text-right">Total Pts</th>
                  <th className="text-right">Events</th>
                  <th className="text-right hidden sm:table-cell">Wins</th>
                  <th className="text-right hidden sm:table-cell">FTs</th>
                  {!isAllTime && <th className="text-right text-success hidden md:table-cell">Bonus</th>}
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((r) => (
                  <tr 
                    key={r.player_id} 
                    className={`
                      hover:bg-base-200/40 transition-colors border-b border-white/5 last:border-0
                      ${r.position === 1 ? 'bg-primary/5 hover:bg-primary/10' : ''}
                    `}
                  >
                    <td className="text-center py-4">
                      {r.position === 1 && <span className="text-3xl drop-shadow-md">🥇</span>}
                      {r.position === 2 && <span className="text-2xl opacity-80">🥈</span>}
                      {r.position === 3 && <span className="text-2xl opacity-60">🥉</span>}
                      {r.position > 3 && (
                        <span className="font-mono font-bold text-xl opacity-30 italic">#{r.position}</span>
                      )}
                    </td>
                    <td>
                      <Link 
                        href={`/players/${encodeURIComponent(r.player_id)}`}
                        className="font-black text-lg text-white hover:text-primary transition-colors block"
                      >
                        {r.display_name}
                      </Link>
                    </td>
                    <td className="text-right font-black text-primary text-xl tracking-tight">
                      {Number(r.total_points).toFixed(2)}
                    </td>
                    <td className="text-right font-mono font-medium opacity-70">
                      {r.events_played}
                    </td>
                    <td className="text-right font-bold text-warning hidden sm:table-cell">
                      {r.wins > 0 ? r.wins : <span className="opacity-10">-</span>}
                    </td>
                    <td className="text-right font-mono opacity-60 hidden sm:table-cell">
                      {r.final_tables > 0 ? r.final_tables : <span className="opacity-10">-</span>}
                    </td>
                    {!isAllTime && (
                      <td className="text-right font-mono text-success opacity-80 hidden md:table-cell">
                        {r.bonus_points && r.bonus_points > 0 ? `+${Number(r.bonus_points)}` : ''}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* PAGINATION */}
        {totalPages > 1 && (
          <div className="card-footer p-4 border-t border-white/5 bg-base-200/20 flex justify-between items-center">
            <div className="text-xs text-base-content/50 font-mono">
              Page {currentPage} of {totalPages}
            </div>
            <div className="join">
              <Link 
                href={`?season=${targetSeasonId}&league=${currentTabSlug}&page=${currentPage - 1}`}
                className={`join-item btn btn-sm ${currentPage <= 1 ? "btn-disabled" : "btn-outline"}`}
              >
                « Prev
              </Link>
              <Link 
                href={`?season=${targetSeasonId}&league=${currentTabSlug}&page=${currentPage + 1}`}
                className={`join-item btn btn-sm ${currentPage >= totalPages ? "btn-disabled" : "btn-outline"}`}
              >
                Next »
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// Simple internal component for the cards to keep code clean
function StatCard({ label, value, subValue, player, rank, icon, color }: any) {
  if (!player) return null;
  return (
    <div className={`card ${color} border border-white/10 shadow-lg relative overflow-hidden group`}>
      {rank && <div className="absolute top-0 right-0 p-4 opacity-10 text-9xl font-black select-none pointer-events-none">{rank}</div>}
      <div className="card-body flex flex-row items-center gap-4 relative z-10">
        {!rank && icon && <div className="text-4xl grayscale opacity-80">{icon}</div>}
        <div>
          <div className="text-xs font-bold uppercase tracking-widest opacity-60">{label}</div>
          <div className="text-2xl font-black text-white">{value} <span className="text-xs font-normal opacity-50">{subValue}</span></div>
          <div className="text-sm font-bold truncate max-w-[150px]">{player}</div>
        </div>
      </div>
    </div>
  );
}