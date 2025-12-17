"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

/* Shared Types */
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

type LeagueMeta = {
  slug: string;
  label: string;
};

function RankMovement({ move }: { move?: number }) {
  // Slightly bigger movement arrows to match new text size
  if (!move) return <span className="text-xs font-bold text-base-content/20 flex items-center justify-center">—</span>;
  if (move > 0) return <span className="text-xs font-bold text-success flex items-center justify-center gap-0.5">▲ {move}</span>;
  return <span className="text-xs font-bold text-error flex items-center justify-center gap-0.5">▼ {Math.abs(move)}</span>;
}

export default function HomeLeaderboard({ 
  leaderboards, 
  leagues,
  seasonLabel 
}: { 
  leaderboards: Record<string, LbRow[]>,
  leagues: LeagueMeta[],
  seasonLabel: string
}) {
  const [activeSlug, setActiveSlug] = useState<string>("");

  useEffect(() => {
    if (leagues.length > 0 && !activeSlug) {
      const defaultLeague = leagues.find(l => l.slug === 'global' || l.slug === 'npl') || leagues[0];
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
        
        {/* DYNAMIC TABS */}
        <div role="tablist" className="tabs tabs-boxed bg-base-200">
          {leagues.map((league) => (
            <a 
              key={league.slug}
              role="tab" 
              className={`tab text-xs font-bold uppercase ${activeSlug === league.slug ? 'tab-active' : ''}`}
              onClick={() => setActiveSlug(league.slug)}
            >
              {league.slug}
            </a>
          ))}
        </div>
      </div>
      
      <div className="p-0 overflow-x-auto">
        {/* ⚠️ CHANGED: Removed 'table-sm' for bigger padding */}
        <table className="table w-full">
          <thead>
            {/* ⚠️ CHANGED: text-[10px] -> text-xs for readability */}
            <tr className="bg-base-200/50 text-xs uppercase text-base-content/60">
              <th className="w-20 text-center py-4">Rank</th>
              <th className="py-4">Player</th>
              <th className="text-right py-4">Events</th>
              <th className="text-right py-4">Wins</th>
              <th className="text-right py-4">Points</th>
            </tr>
          </thead>
          <tbody>
            {displayData.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 opacity-50 text-sm">No rankings available.</td></tr>
            ) : (
                displayData.map((r, i) => (
                <tr key={`${r.player_id || 'anon'}-${i}`} className="hover:bg-base-200/30 transition-colors border-b border-base-200/50">
                    <td className="text-center py-3">
                      {/* ⚠️ CHANGED: text-lg -> text-xl */}
                      <div className="font-black text-xl italic text-base-content/40">{r.position}</div>
                      <div className="mt-1"><RankMovement move={r.movement} /></div>
                    </td>
                    <td className="py-3">
                    {r.is_anonymized || !r.player_id ? (
                        // ANONYMOUS PLAYER
                        // ⚠️ CHANGED: text-sm -> text-base. Avatar w-10 h-10 rounded-md.
                        <div className="font-bold text-base text-white/50 italic flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-base-300 flex items-center justify-center text-lg font-bold text-base-content/30">🔒</div>
                            {r.display_name}
                        </div>
                    ) : (
                        // LINKED PLAYER
                        // ⚠️ CHANGED: text-sm -> text-base. Avatar w-10 h-10 rounded-md. Initial text-lg.
                        <Link href={`/players/${r.player_id}`} className="font-bold text-base hover:text-primary transition-colors flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-base-300 flex items-center justify-center text-lg font-bold text-base-content/50">
                            {r.display_name.charAt(0)}
                            </div>
                            {r.display_name}
                        </Link>
                    )}
                    </td>
                    {/* ⚠️ CHANGED: text-xs -> text-sm for stats */}
                    <td className="text-right font-mono text-sm text-base-content/70 py-3">{r.events_played}</td>
                    <td className="text-right font-mono text-sm text-base-content/70 py-3">{r.wins ?? 0}</td>
                    {/* ⚠️ CHANGED: text-base -> text-lg for points */}
                    <td className="text-right font-black text-primary text-lg py-3">{Number(r.total_points).toFixed(2)}</td>
                </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
      <div className="p-4 border-t border-base-200 text-center">
        <Link href="/leaderboards" className="btn btn-ghost btn-sm uppercase font-bold tracking-widest">
          View Full Leaderboard →
        </Link>
      </div>
    </div>
  );
}