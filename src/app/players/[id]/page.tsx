// src/app/players/[id]/page.tsx
import Link from "next/link";
import { headers } from "next/headers";

export const runtime = "nodejs";
export const revalidate = 0;

type Profile = {
  id: string;
  name: string;
  avatar_url: string | null;
  aliases: string[];
  stats: {
    all_time: { total_points: number; results: number; avg_points: number };
    current_season: {
      total_points: number;
      results: number;        // counted
      avg_points: number;     // counted average
      lowest_counted: number;
    };
  };
  recent_results: Array<{
    result_id: string;
    event_id: string;
    event_name: string;
    event_date: string | null;
    is_high_roller: boolean;
    points: number;
  }>;
};

// ---- data fetch + mapping (defensive; no ??/|| mixing) ----
async function fetchProfileAbsolute(id: string): Promise<Profile | null> {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host")) ?? "localhost:3000";
  const proto = (h.get("x-forwarded-proto") ?? "http");
  const base = `${proto}://${host}`;

  const res = await fetch(`${base}/api/players/${encodeURIComponent(id)}`, {
    cache: "no-store",
    headers: { "x-forwarded-host": host, "x-forwarded-proto": proto },
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || !json) return null;

  const p = json.profile ?? {};
  const s = (json.stats ?? p.stats) ?? {};
  const at = s.all_time ?? {};
  const cs = s.current_season ?? {};
  const recentArr: any[] = Array.isArray(json.recent_results)
    ? json.recent_results
    : Array.isArray(p.recent_results)
    ? p.recent_results
    : [];

  // safe name
  let nameCandidate: string | undefined = p.name;
  if (!nameCandidate) {
    const first = (p.forename as string | undefined) ?? (p.first_name as string | undefined) ?? "";
    const last  = (p.surname as string | undefined) ?? (p.last_name as string | undefined) ?? "";
    const combo = `${first} ${last}`.trim();
    nameCandidate = combo.length > 0 ? combo : undefined;
  }
  const finalName = (nameCandidate && nameCandidate.length > 0) ? nameCandidate : `Player ${id}`;

  const mapped: Profile = {
    id: String(p.id ?? json.id ?? id),
    name: finalName,
    avatar_url: p.avatar_url ?? null,
    aliases: Array.isArray(p.aliases) ? p.aliases : [],
    stats: {
      all_time: {
        total_points: Number(at.total_points ?? at.total ?? 0) || 0,
        results: Number(at.results ?? at.count ?? 0) || 0,
        avg_points: Number(at.avg_points ?? at.average ?? 0) || 0,
      },
      current_season: {
        total_points: Number(cs.total_points ?? cs.total ?? 0) || 0,
        results: Number(
          (cs.results as number | undefined) ??
          (cs.results_counted as number | undefined) ??
          (cs.count_used as number | undefined) ??
          (cs.used as number | undefined) ??
          0
        ) || 0,
        avg_points: Number(
          (cs.avg_points as number | undefined) ??
          (cs.avg_counted as number | undefined) ??
          (cs.average as number | undefined) ??
          0
        ) || 0,
        lowest_counted: Number(cs.lowest_counted ?? cs.lowest ?? 0) || 0,
      },
    },
    recent_results: recentArr.map((r: any) => {
      const rawDate =
        (r.event_date as string | undefined) ??
        (r.date as string | undefined) ??
        (r.start_date as string | undefined) ??
        "";
      const event_date = rawDate ? String(rawDate) : null;

      return {
        result_id: String(r.result_id ?? r.id ?? `${r.event_id ?? "evt"}-${rawDate}`),
        event_id: String(r.event_id ?? r.tournament_id ?? r.id ?? ""),
        event_name: String(r.event_name ?? r.tournament_name ?? r.name ?? "Event"),
        event_date,
        is_high_roller: Boolean(r.is_high_roller ?? r.is_hrl ?? r.hrl ?? false),
        points: Number(r.points ?? r.score ?? 0) || 0,
      };
    }),
  };

  return mapped;
}

// ---- small presentational helpers (server-safe) ----
function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-xl font-semibold nums">{value}</div>
      {sub ? <div className="text-xs text-neutral-500 mt-1">{sub}</div> : null}
    </div>
  );
}

export default async function PlayerPage({ params }: { params: { id: string } }) {
  const { id } = params;

  const profile = await fetchProfileAbsolute(id);

  if (!profile) {
    return (
      <div className="space-y-4">
        <div className="card p-4">
          <div className="text-red-600">Player not found or no data.</div>
          <div className="mt-2">
            <Link href="/players" className="underline">← Back to players</Link>
          </div>
        </div>
      </div>
    );
  }

  const at = profile.stats.all_time;
  const cs = profile.stats.current_season;

  return (
    <div className="space-y-6">
      <nav className="text-sm">
        <a className="underline" href="/">National Poker League</a>
        <span className="mx-1">/</span>
        <a className="underline" href="/players">Players</a>
      </nav>

      {/* Header */}
      <div className="card p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-16 w-16 rounded-full bg-neutral-200 overflow-hidden grid place-items-center">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt={profile.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-lg font-semibold">
                  {profile.name?.slice(0, 1) || "?"}
                </span>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-semibold">{profile.name || `Player ${id}`}</h1>
              {profile.aliases?.length ? (
                <div className="text-xs text-neutral-500">aka {profile.aliases.join(", ")}</div>
              ) : null}
            </div>
          </div>
          <div className="text-sm">
            <Link href="/players" className="underline">← Back to players</Link>
          </div>
        </div>
      </div>

      {/* All-time snapshot */}
      <section className="space-y-2">
        <div className="card-header">All-Time</div>
        <div className="grid sm:grid-cols-3 gap-3">
          <StatCard label="Total Points" value={at.total_points.toFixed(2)} />
          <StatCard label="Results" value={at.results} sub={`${at.avg_points.toFixed(2)} avg`} />
          <StatCard label="Avg Points" value={at.avg_points.toFixed(2)} />
        </div>
      </section>

      {/* Current season snapshot */}
      <section className="space-y-2">
        <div className="card-header">Current Season</div>
        <div className="grid sm:grid-cols-4 gap-3">
          <StatCard label="Total Points" value={cs.total_points.toFixed(2)} />
          <StatCard label="Results Counted" value={cs.results} />
          <StatCard label="Avg (Counted)" value={cs.avg_points.toFixed(2)} />
          <StatCard label="Lowest Counted" value={cs.lowest_counted.toFixed(2)} />
        </div>
      </section>

      {/* Recent results */}
      <section className="card overflow-x-auto">
        <div className="card-header">Recent Results</div>
        {!profile.recent_results?.length ? (
          <div className="card-body text-sm text-neutral-600">No recent results.</div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th className="text-left">Date</th>
                <th className="text-left">Event</th>
                <th className="text-left">League</th>
                <th className="text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {profile.recent_results.map((r) => (
                <tr key={r.result_id} className="align-top">
                  <td>{r.event_date ?? "—"}</td>
                  <td className="p-3">
  <a className="underline" href={`/events/${encodeURIComponent(r.event_id)}`}>
    {r.event_name}
  </a>
</td>
                  <td>
                    <span className={`badge ${r.is_high_roller ? "badge-hrl" : "badge-npl"}`}>
                      {r.is_high_roller ? "HRL" : "NPL"}
                    </span>
                  </td>
                  <td className="text-right nums">{r.points.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
