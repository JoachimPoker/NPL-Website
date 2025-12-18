"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

function RankMovement({ move }: { move?: number }) {
  // We must handle the number 0 specifically
  if (move === undefined || move === null || move === 0) {
    return <span className="text-xs font-bold text-base-content/20 flex items-center justify-center">—</span>;
  }
  
  if (move > 0) {
    return <span className="text-xs font-bold text-success flex items-center justify-center gap-0.5">▲ {move}</span>;
  }
  
  return <span className="text-xs font-bold text-error flex items-center justify-center gap-0.5">▼ {Math.abs(move)}</span>;
}

export default function HomeLeaderboard({ leaderboards, leagues, seasonLabel, cap }: any) {
  const [activeSlug, setActiveSlug] = useState<string>("");

  useEffect(() => {
    if (leagues && leagues.length > 0 && !activeSlug) {
      const defaultLeague = leagues.find((l: any) => l.slug === 'npl' || l.slug === 'global') || leagues[0];
      setActiveSlug(defaultLeague.slug);
    }
  }, [leagues, activeSlug]);

  const activeData = activeSlug ? (leaderboards[activeSlug] || []) : [];
  const displayData = activeData.slice(0, 10);

  return (
    <div className="card bg-base-100 shadow-xl border border-white/5">
      <div className="card-header p-4 border-b border-base-200 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-center sm:text-left">
           <h3 className="text-lg font-bold uppercase tracking-wide">🏆 Official Leaderboards</h3>
           <div className="text-[10px] opacity-50 uppercase tracking-widest">{seasonLabel}</div>
        </div>
        
        <div role="tablist" className="tabs tabs-boxed bg-base-200">
          {leagues?.map((league: any) => (
            <button 
              key={league.slug}
              role="tab" 
              className={`tab text-xs font-bold uppercase ${activeSlug === league.slug ? 'tab-active' : ''}`}
              onClick={() => setActiveSlug(league.slug)}
            >
              {league.slug}
            </button>
          ))}
        </div>
      </div>
      
      <div className="p-0 overflow-x-auto">
        <table className="table w-full">
          <thead>
            <tr className="bg-base-200/50 text-xs uppercase text-base-content/60">
              <th className="w-20 text-center py-4">Rank</th>
              <th className="py-4">Player</th>
              <th className="text-center py-4">Results</th>
              <th className="text-center py-4">Wins</th>
              <th className="text-center py-4">FT</th>
              <th className="text-right py-4">Points</th>
            </tr>
          </thead>
          <tbody>
            {displayData.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 opacity-30">No data available</td></tr>
            ) : (
              displayData.map((r: any, i: number) => (
                <tr key={`${r.player_id}-${i}`} className="hover:bg-base-200/30 transition-colors border-b border-base-200/50">
                    <td className="text-center py-3">
                      <div className="font-black text-xl italic text-base-content/40">{r.position}</div>
                      <div className="mt-1">
                        <RankMovement move={r.movement} />
                      </div>
                    </td>
                    <td className="py-3">
                      {!r.player_id ? (
                        <div className="font-bold text-base text-white/50 italic flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-base-300 flex items-center justify-center text-lg font-bold text-base-content/30">🔒</div>
                            {r.display_name}
                        </div>
                      ) : (
                        <Link href={`/players/${r.player_id}`} className="font-bold text-base hover:text-primary transition-colors flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-lg font-bold text-primary">
                              {r.display_name?.charAt(0) || '?'}
                            </div>
                            {r.display_name}
                        </Link>
                      )}
                    </td>
                    <td className="text-center font-mono text-sm text-base-content/70 py-3">
                       {activeSlug === 'npl' && cap > 0 && r.events_played > cap ? (
                          <span className="text-primary font-bold">{cap} <span className="text-[10px] opacity-40 font-normal">({r.events_played})</span></span>
                       ) : (
                          r.events_played
                       )}
                    </td>
                    <td className="text-center font-mono text-sm text-base-content/70 py-3">{r.wins ?? 0}</td>
                    <td className="text-center font-mono text-sm text-base-content/70 py-3">{r.top9_count ?? 0}</td>
                    <td className="text-right font-black text-primary text-lg py-3">{Number(r.total_points || 0).toFixed(1)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}