// src/app/players/[id]/page.tsx
import Link from "next/link";
import { getPlayerProfile } from "@/lib/data";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

const PLACEHOLDER_AVATAR_URL = "/avatar-default.svg";

export const runtime = "nodejs";
export const revalidate = 60;

type PlayerPageProps = {
  params: Promise<{ id: string }>;
};

export default async function PlayerProfile(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params;

  // 1. TRACKING
  const supabase = await createSupabaseServerClient();
  try {
    await supabase.from("player_searches").insert({ player_id: id });
  } catch (e) {
    console.error("Tracking error:", e);
  }

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

  const p = data.player;
  const recent = data.recent_results;

  // Stats Logic (Same as before)
  const totalResults = recent.length;
  const totalPointsRecent = recent.reduce((sum, r) => sum + (Number(r.points) || 0), 0);
  const avgPointsRecent = totalResults ? totalPointsRecent / totalResults : 0;
  const cashes = recent.filter((r) => r.prize_amount !== null && Number(r.prize_amount) > 0);
  const cashesCount = cashes.length;
  const totalPrize = recent.reduce((sum, r) => sum + (Number(r.prize_amount) || 0), 0);
  const lifetimePoints = Number(data.stats.lifetime_points ?? 0);
  const biggestCash = cashes.reduce((max, r) => Math.max(max, Number(r.prize_amount) || 0), 0);
  const bestFinish = recent.reduce((best, r) => {
    if (typeof r.position_of_prize === "number") {
      return best === null ? r.position_of_prize : Math.min(best, r.position_of_prize);
    }
    return best;
  }, null as number | null);

  const achievementBadges = ["GUKPT Winner", "NPL Winner", "25/50 Winner"]; // Placeholders

  return (
    <div className="container mx-auto max-w-7xl space-y-8 py-8 px-4">
      {/* 1. Identity Card */}
      <section className="card bg-base-100 shadow-xl border border-white/5 overflow-hidden">
        {/* Background gradient splash */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
        
        <div className="card-body flex flex-col md:flex-row items-center md:items-start gap-8 relative z-10">
          {/* Avatar "Poker Chip" Style */}
          <div className="avatar">
            <div className="w-32 rounded-full ring-4 ring-base-100 shadow-2xl bg-base-300 p-1">
              <div className="w-full h-full rounded-full overflow-hidden bg-neutral flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={p.avatar_url || PLACEHOLDER_AVATAR_URL} 
                  alt={p.name ?? ""} 
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          <div className="flex-1 text-center md:text-left space-y-2">
            <h1 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter text-white">
              {p.name}
            </h1>
            <div className="flex flex-wrap justify-center md:justify-start gap-2">
              <span className="badge badge-lg badge-primary font-bold uppercase text-xs tracking-wider">Pro Player</span>
              {p.consent && <span className="badge badge-lg badge-ghost border-white/10 font-bold uppercase text-xs tracking-wider">Verified</span>}
            </div>
            
            <div className="pt-4 flex flex-wrap justify-center md:justify-start gap-2">
              {achievementBadges.map((b) => (
                <span key={b} className="badge badge-outline text-xs text-base-content/60 border-white/10">{b}</span>
              ))}
            </div>
          </div>

          {/* Quick Stats Box */}
          <div className="grid grid-cols-2 gap-4 bg-base-200/50 p-4 rounded-xl border border-white/5 min-w-[200px]">
            <div>
              <div className="text-xs font-bold uppercase text-base-content/40 tracking-wider">Lifetime Pts</div>
              <div className="text-2xl font-black text-primary">{lifetimePoints.toFixed(0)}</div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase text-base-content/40 tracking-wider">Winnings</div>
              <div className="text-2xl font-black text-white">£{Math.round(totalPrize/1000)}k</div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Detailed Stats Grid */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Results Tracked", value: totalResults, sub: "Last 30 events" },
          { label: "Cashes (ITM)", value: cashesCount, sub: `${totalResults ? ((cashesCount/totalResults)*100).toFixed(0) : 0}% Rate` },
          { label: "Best Finish", value: bestFinish ? `#${bestFinish}` : "-", sub: "In selection" },
          { label: "Biggest Cash", value: biggestCash ? `£${biggestCash}` : "-", sub: "Single event" },
        ].map((stat) => (
          <div key={stat.label} className="card bg-base-100 shadow-lg border border-white/5 p-5 hover:border-primary/30 transition-colors">
            <div className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-1">{stat.label}</div>
            <div className="text-3xl font-black text-white">{stat.value}</div>
            <div className="text-xs text-base-content/60 mt-1">{stat.sub}</div>
          </div>
        ))}
      </section>

      {/* 3. Recent Results Table */}
      <section className="card bg-base-100 shadow-xl border border-white/5 overflow-hidden">
        <div className="card-header p-6 border-b border-white/5 flex justify-between items-center">
          <h3 className="text-xl font-bold uppercase tracking-wide">Recent Performance</h3>
          <span className="text-xs font-bold uppercase text-base-content/40 tracking-widest">Last 30 Events</span>
        </div>
        <div className="p-0 overflow-x-auto">
          {!recent.length ? (
            <div className="p-8 text-center text-base-content/50 italic">No recent results found.</div>
          ) : (
            <table className="table table-lg w-full">
              <thead>
                <tr className="bg-base-200/50 text-xs uppercase text-base-content/60 border-b border-white/5">
                  <th>Date</th>
                  <th>Event</th>
                  <th>Venue</th>
                  <th className="text-right">Pos</th>
                  <th className="text-right">Points</th>
                  <th className="text-right">Prize</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => {
                  const isWin = r.position_of_prize === 1;
                  const isCash = r.prize_amount && Number(r.prize_amount) > 0;
                  return (
                    <tr key={r.id} className="hover:bg-base-200/30 transition-colors border-b border-base-200/50 last:border-0">
                      <td className="font-mono text-xs opacity-60">
                        {r.event?.start_date ? new Date(r.event.start_date).toLocaleDateString("en-GB") : "—"}
                      </td>
                      <td className="font-bold text-white">
                        {r.event?.name || "Unknown Event"}
                        <div className="text-xs font-normal opacity-50 md:hidden">{r.event?.site_name}</div>
                      </td>
                      <td className="text-sm opacity-70 hidden md:table-cell">{r.event?.site_name || "—"}</td>
                      <td className="text-right font-mono">
                        {isWin ? <span className="text-warning">🏆 1st</span> : r.position_of_prize ? `#${r.position_of_prize}` : "—"}
                      </td>
                      <td className="text-right font-mono font-bold text-primary">{r.points ? Number(r.points).toFixed(2) : "0.00"}</td>
                      <td className={`text-right font-mono ${isCash ? "text-success" : "opacity-30"}`}>
                        {r.prize_amount ? `£${r.prize_amount}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <div className="text-center pt-4">
        <Link href="/players" className="btn btn-ghost btn-sm uppercase font-bold text-xs tracking-widest opacity-60 hover:opacity-100">
          ← Back to All Players
        </Link>
      </div>
    </div>
  );
}