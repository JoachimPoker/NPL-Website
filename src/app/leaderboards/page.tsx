"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function LeaderboardsPage() {
  const [leagues, setLeagues] = useState<{ slug: string, label: string }[]>([]);
  const [activeSlug, setActiveSlug] = useState<string>("");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // 1. Load available leagues on mount
  useEffect(() => {
    async function init() {
      const res = await fetch("/api/home");
      const json = await res.json();
      if (json.ok && json.leagues?.length > 0) {
        setLeagues(json.leagues);
        setActiveSlug(json.leagues[0].slug); // Default to first league
      }
    }
    init();
  }, []);

  // 2. Load leaderboard data when tab changes
  useEffect(() => {
    if (!activeSlug) return;
    async function loadData() {
        setLoading(true);
        const res = await fetch(`/api/leaderboards/season?league=${activeSlug}`);
        const json = await res.json();
        setData(json.rows || []);
        setLoading(false);
    }
    loadData();
  }, [activeSlug]);

  const filteredData = data.filter(p => p.display_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-base-200 py-12 px-4">
      <div className="container mx-auto max-w-5xl space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-2">
            <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white">Season Standings</h1>
            <p className="text-base-content/60">Official NPL Rankings</p>
        </div>

        {/* Dynamic Tabs */}
        {leagues.length > 0 && (
            <div className="flex justify-center">
                <div role="tablist" className="tabs tabs-boxed bg-base-100 p-1 border border-white/5">
                    {leagues.map(l => (
                        <a 
                            key={l.slug} 
                            role="tab" 
                            className={`tab ${activeSlug === l.slug ? 'tab-active font-bold' : ''}`}
                            onClick={() => setActiveSlug(l.slug)}
                        >
                            {l.label}
                        </a>
                    ))}
                </div>
            </div>
        )}

        {/* Search */}
        <div className="flex justify-end">
            <input 
                className="input input-sm input-bordered w-full max-w-xs" 
                placeholder="Search player..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
            />
        </div>

        {/* Table */}
        <div className="card bg-base-100 shadow-xl border border-white/5 overflow-hidden">
            {loading ? (
                <div className="p-12 text-center"><span className="loading loading-spinner loading-lg"></span></div>
            ) : (
                <table className="table w-full">
                    <thead className="bg-base-200/50 text-xs font-bold uppercase">
                        <tr>
                            <th className="w-16 text-center">Rank</th>
                            <th>Player</th>
                            <th className="text-right">Points</th>
                            <th className="text-right">Events</th>
                            <th className="text-right pr-6">Wins</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredData.map((row) => (
                            <tr key={row.player_id} className="hover:bg-base-200/20 border-b border-white/5 last:border-0">
                                <td className="text-center font-black text-lg font-mono text-base-content/50">
                                    {row.position}
                                </td>
                                <td>
                                    <Link href={`/players/${row.player_id}`} className="font-bold hover:text-primary transition-colors">
                                        {row.display_name}
                                    </Link>
                                </td>
                                <td className="text-right font-black text-primary font-mono text-lg">
                                    {Number(row.total_points).toFixed(0)}
                                </td>
                                <td className="text-right font-mono text-base-content/60">
                                    {row.events_played}
                                </td>
                                <td className="text-right pr-6 font-mono text-base-content/60">
                                    {row.win_count}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>

      </div>
    </div>
  );
}