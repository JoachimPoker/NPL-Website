"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

function RankMovement({ move }: { move?: number }) {
  if (!move) {
    return <span className="text-[11px] text-base-content/25" aria-label="No change">–</span>;
  }
  if (move > 0) {
    return <span className="text-[11px] font-medium text-success" aria-label={`Up ${move}`}>▲{move}</span>;
  }
  return <span className="text-[11px] font-medium text-error" aria-label={`Down ${Math.abs(move)}`}>▼{Math.abs(move)}</span>;
}

export function Initial({ name, muted = false }: { name?: string; muted?: boolean }) {
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] font-display text-sm font-semibold ${
        muted ? "bg-base-300 text-base-content/30" : "bg-primary/12 text-primary ring-1 ring-inset ring-primary/20"
      }`}
      aria-hidden="true"
    >
      {name?.charAt(0)?.toUpperCase() || "?"}
    </span>
  );
}

export default function HomeLeaderboard({ leaderboards, leagues, seasonLabel, cap }: any) {
  const defaultSlug =
    leagues?.find((l: any) => l.slug === "npl" || l.slug === "global")?.slug ?? leagues?.[0]?.slug ?? "";
  const [activeSlug, setActiveSlug] = useState<string>(defaultSlug);

  const displayData = (leaderboards?.[activeSlug] || []).slice(0, 10);
  const activeLeague = leagues?.find((l: any) => l.slug === activeSlug);

  return (
    <section className="panel overflow-hidden" aria-labelledby="home-standings">
      <div className="flex flex-col gap-4 border-b border-base-content/[0.07] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          {activeLeague?.logo_url ? (
            <>
              <h2 id="home-standings" className="sr-only">Leaderboard: {activeLeague.label}</h2>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={activeLeague.logo_url} alt="" className="h-10 w-auto max-w-72 rounded-[4px] object-contain object-left" />
            </>
          ) : (
            <h2 id="home-standings" className="font-display text-xl font-semibold tracking-tight">Leaderboard</h2>
          )}
          <div className={`text-sm text-base-content/50 ${activeLeague?.logo_url ? "mt-2" : ""}`}>{seasonLabel} · top 10</div>
        </div>

        <div role="tablist" aria-label="League" className="inline-flex rounded-lg bg-base-300/70 p-1">
          {leagues?.map((league: any) => {
            const active = activeSlug === league.slug;
            return (
              <button
                key={league.slug}
                role="tab"
                aria-selected={active}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  active ? "bg-base-100 text-base-content shadow-sm" : "text-base-content/55 hover:text-base-content"
                }`}
                onClick={() => setActiveSlug(league.slug)}
              >
                <span className="sm:hidden">{league.slug.toUpperCase()}</span>
                <span className="hidden sm:inline">{league.label || league.slug.toUpperCase()}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="table w-full">
          <thead>
            <tr>
              <th className="w-12 pl-4 text-center sm:w-16 sm:pl-6">#</th>
              <th>Player</th>
              <th className="hidden text-right sm:table-cell">Results</th>
              <th className="hidden text-right sm:table-cell">Wins</th>
              <th className="hidden text-right sm:table-cell">FTs</th>
              <th className="pr-4 text-right sm:pr-6">Points</th>
            </tr>
          </thead>
          <tbody>
            {displayData.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <div className="font-display text-lg text-base-content/70">No results yet this season</div>
                  <div className="mt-1 text-sm text-base-content/40">Leaderboards appear here after the first event is scored.</div>
                </td>
              </tr>
            ) : (
              displayData.map((r: any, i: number) => {
                const podium = r.position <= 3;
                return (
                  <tr key={`${r.player_id}-${i}`} className="transition-colors hover:bg-base-content/[0.03]">
                    <td className="pl-4 text-center sm:pl-6">
                      <div className={`font-mono text-base font-semibold ${podium ? "text-primary" : "text-base-content/45"}`}>
                        {r.position}
                      </div>
                      <RankMovement move={r.movement} />
                    </td>
                    <td>
                      {!r.player_id ? (
                        <div className="flex items-center gap-3 text-base-content/45">
                          <Initial name={r.display_name} muted />
                          <span className="italic">{r.display_name}</span>
                        </div>
                      ) : (
                        <Link href={`/players/${r.player_id}`} className="group flex items-center gap-3 font-medium">
                          <Initial name={r.display_name} />
                          <span className="transition-colors group-hover:text-primary">{r.display_name}</span>
                        </Link>
                      )}
                    </td>
                    <td className="hidden text-right font-mono text-sm text-base-content/65 sm:table-cell">
                      {activeSlug === "npl" && cap > 0 && r.events_played > cap ? (
                        <span title={`${r.events_played} played, best ${cap} count`}>
                          {cap}<span className="ml-1 text-[11px] text-base-content/35">/{r.events_played}</span>
                        </span>
                      ) : (
                        r.events_played
                      )}
                    </td>
                    <td className="hidden text-right font-mono text-sm text-base-content/65 sm:table-cell">{r.wins ?? 0}</td>
                    <td className="hidden text-right font-mono text-sm text-base-content/65 sm:table-cell">{r.top9_count ?? 0}</td>
                    <td className="pr-4 text-right font-mono text-base font-semibold sm:pr-6">
                      {Number(r.total_points || 0).toFixed(2)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-base-content/[0.07] px-6 py-4">
        <Link href="/leaderboards" className="group inline-flex items-center gap-1.5 text-sm font-medium text-primary">
          Full leaderboard
          <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </section>
  );
}
