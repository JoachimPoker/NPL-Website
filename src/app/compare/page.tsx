// src/app/compare/page.tsx
import { headers } from "next/headers";

export const runtime = "nodejs";
export const revalidate = 0;

/* ---------- Types ---------- */
type Profile = {
  id: string;
  name: string;
  aliases: string[];
  stats: {
    all_time: { total_points: number; results: number; avg_points: number };
    current_season: {
      total_points: number;
      results: number;
      avg_points: number;
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

type RawProfile = any;

/* ---------- Helpers ---------- */
async function baseUrl() {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host")) ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

async function fetchJSON<T>(path: string): Promise<T | null> {
  const res = await fetch(`${await baseUrl()}${path}`, { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

function parseParams(sp: Record<string, string | string[] | undefined>) {
  const raw = Array.isArray(sp.players) ? sp.players[0] : sp.players;
  const list = (raw ?? "")
    .toString()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  // cap to 4 columns for readability
  return list.slice(0, 4);
}

// re-use the robust mapper from the player page
function mapProfile(json: RawProfile, id: string): Profile | null {
  if (!json) return null;
  const p = json.profile ?? {};
  const s = (json.stats ?? p.stats) ?? {};
  const at = s.all_time ?? {};
  const cs = s.current_season ?? {};
  const recentArr: any[] = Array.isArray(json.recent_results)
    ? json.recent_results
    : Array.isArray(p.recent_results)
    ? p.recent_results
    : [];

  // name
  let nameCandidate: string | undefined = p.name;
  if (!nameCandidate) {
    const first =
      (p.forename as string | undefined) ??
      (p.first_name as string | undefined) ??
      "";
    const last =
      (p.surname as string | undefined) ??
      (p.last_name as string | undefined) ??
      "";
    const combo = `${first} ${last}`.trim();
    nameCandidate = combo.length > 0 ? combo : undefined;
  }
  const finalName =
    nameCandidate && nameCandidate.length > 0
      ? nameCandidate
      : `Player ${id}`;

  return {
    id: String(p.id ?? json.id ?? id),
    name: finalName,
    aliases: Array.isArray(p.aliases) ? p.aliases : [],
    stats: {
      all_time: {
        total_points: Number(at.total_points ?? at.total ?? 0) || 0,
        results: Number(at.results ?? at.count ?? 0) || 0,
        avg_points: Number(at.avg_points ?? at.average ?? 0) || 0,
      },
      current_season: {
        total_points: Number(cs.total_points ?? cs.total ?? 0) || 0,
        results:
          Number(
            (cs.results as number | undefined) ??
              (cs.results_counted as number | undefined) ??
              (cs.count_used as number | undefined) ??
              (cs.used as number | undefined) ??
              0
          ) || 0,
        avg_points:
          Number(
            (cs.avg_points as number | undefined) ??
              (cs.avg_counted as number | undefined) ??
              (cs.average as number | undefined) ??
              0
          ) || 0,
        lowest_counted: Number(cs.lowest_counted ?? cs.lowest ?? 0) || 0,
      },
    },
    recent_results: recentArr.slice(0, 5).map((r: any) => {
      const rawDate =
        (r.event_date as string | undefined) ??
        (r.date as string | undefined) ??
        (r.start_date as string | undefined) ??
        "";
      const event_date = rawDate ? String(rawDate) : null;

      return {
        result_id: String(
          r.result_id ?? r.id ?? `${r.event_id ?? "evt"}-${rawDate}`
        ),
        event_id: String(r.event_id ?? r.tournament_id ?? r.id ?? ""),
        event_name: String(
          r.event_name ?? r.tournament_name ?? r.name ?? "Event"
        ),
        event_date,
        is_high_roller: Boolean(
          r.is_high_roller ?? r.is_hrl ?? r.hrl ?? false
        ),
        points: Number(r.points ?? r.score ?? 0) || 0,
      };
    }),
  };
}

/* ---------- Page ---------- */
export default async function ComparePage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const ids = parseParams(searchParams);

  const profiles = await Promise.all(
    ids.map(async (id) => {
      const raw = await fetchJSON<RawProfile>(
        `/api/players/${encodeURIComponent(id)}`
      );
      return mapProfile(raw, id);
    })
  );

  const valid = profiles.filter(Boolean) as Profile[];

  return (
    <div className="space-y-6">
      {/* Header & picker */}
      <section className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h1 className="text-2xl font-semibold">Compare players</h1>
          <p className="text-sm text-base-content/70 mt-1">
            Enter player IDs (comma-separated), e.g. <code>123,456</code>
          </p>
          <form
            action="/compare"
            method="get"
            className="mt-3 flex flex-wrap items-center gap-2"
          >
            <input
              name="players"
              defaultValue={ids.join(",")}
              placeholder="Player IDs, comma-separated"
              className="input input-bordered w-full max-w-md text-sm"
            />
            <button
              className="btn btn-primary btn-sm"
              type="submit"
            >
              Compare
            </button>
            {valid.length ? (
              <a
                className="btn btn-ghost btn-sm"
                href={`/leaderboards?scope=season&type=npl&mode=simple&seasonId=current`}
              >
                Back to leaderboards →
              </a>
            ) : null}
          </form>
        </div>
      </section>

      {!valid.length ? (
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body text-sm text-base-content/70">
            Add some player IDs above to compare.
          </div>
        </div>
      ) : (
        <>
          {/* All-time KPIs */}
          <section className="card bg-base-100 shadow-sm overflow-hidden">
            <div className="card-body border-b border-base-200 pb-3">
              <h2 className="font-semibold">All-Time Snapshot</h2>
            </div>
            <div className="card-body">
              <div
                className="grid gap-4"
                style={{
                  gridTemplateColumns: `repeat(${valid.length}, minmax(0, 1fr))`,
                }}
              >
                {valid.map((p) => (
                  <div
                    key={p.id}
                    className="card bg-base-100 border border-base-200"
                  >
                    <div className="card-body p-3">
                      <div className="text-sm font-semibold">
                        <a
                          className="link link-primary"
                          href={`/players/${encodeURIComponent(p.id)}`}
                        >
                          {p.name}
                        </a>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <div>
                          <div className="text-xs text-base-content/60">
                            Total
                          </div>
                          <div className="text-xl font-semibold nums">
                            {p.stats.all_time.total_points.toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-base-content/60">
                            Results
                          </div>
                          <div className="text-xl font-semibold nums">
                            {p.stats.all_time.results}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-base-content/60">
                            Avg
                          </div>
                          <div className="text-xl font-semibold nums">
                            {p.stats.all_time.avg_points.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Current season KPIs */}
          <section className="card bg-base-100 shadow-sm overflow-hidden">
            <div className="card-body border-b border-base-200 pb-3">
              <h2 className="font-semibold">Current Season</h2>
            </div>
            <div className="card-body">
              <div
                className="grid gap-4"
                style={{
                  gridTemplateColumns: `repeat(${valid.length}, minmax(0, 1fr))`,
                }}
              >
                {valid.map((p) => (
                  <div
                    key={p.id}
                    className="card bg-base-100 border border-base-200"
                  >
                    <div className="card-body p-3">
                      <div className="text-sm font-semibold">
                        <a
                          className="link link-primary"
                          href={`/players/${encodeURIComponent(p.id)}`}
                        >
                          {p.name}
                        </a>
                      </div>
                      <div className="mt-2 grid grid-cols-4 gap-2">
                        <div>
                          <div className="text-xs text-base-content/60">
                            Total
                          </div>
                          <div className="text-xl font-semibold nums">
                            {p.stats.current_season.total_points.toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-base-content/60">
                            Results
                          </div>
                          <div className="text-xl font-semibold nums">
                            {p.stats.current_season.results}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-base-content/60">
                            Avg
                          </div>
                          <div className="text-xl font-semibold nums">
                            {p.stats.current_season.avg_points.toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-base-content/60">
                            Lowest
                          </div>
                          <div className="text-xl font-semibold nums">
                            {p.stats.current_season.lowest_counted.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Recent results (last 5) */}
          <section className="card bg-base-100 shadow-sm overflow-hidden">
            <div className="card-body border-b border-base-200 pb-3">
              <h2 className="font-semibold">Recent Results</h2>
            </div>
            <div className="card-body">
              <div
                className="grid gap-4"
                style={{
                  gridTemplateColumns: `repeat(${valid.length}, minmax(0, 1fr))`,
                }}
              >
                {valid.map((p) => (
                  <div key={p.id}>
                    <div className="text-sm font-semibold mb-2">
                      <a
                        className="link link-primary"
                        href={`/players/${encodeURIComponent(p.id)}`}
                      >
                        {p.name}
                      </a>
                    </div>
                    {p.recent_results.length === 0 ? (
                      <div className="text-sm text-base-content/70">
                        No recent results.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="table table-xs w-full">
                          <thead>
                            <tr>
                              <th className="text-left">Date</th>
                              <th className="text-left">Event</th>
                              <th className="text-right">Pts</th>
                            </tr>
                          </thead>
                          <tbody>
                            {p.recent_results.map((r) => (
                              <tr key={r.result_id}>
                                <td>{r.event_date ?? "—"}</td>
                                <td>
                                  <a
                                    className="link link-hover"
                                    href={`/events/${encodeURIComponent(
                                      r.event_id
                                    )}`}
                                  >
                                    {r.event_name}
                                  </a>
                                </td>
                                <td className="text-right nums">
                                  {r.points.toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
