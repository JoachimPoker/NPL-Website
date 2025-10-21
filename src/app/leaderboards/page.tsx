// src/app/leaderboards/page.tsx
import { headers } from "next/headers";

export const runtime = "nodejs";
export const revalidate = 0;

/* ---------------- Types (aligned with your API) ---------------- */
type LbRow = {
  position: number;
  player_id: string;
  name: string;
  total_points: number;
  results_display: string;  // e.g. "20 (27)"
  average_display: string;  // e.g. "18.23 (16.10)"
  lowest_points: number;
  top_results?: number[];   // for advanced BEST-X table
};

type SeasonMeta = {
  id: number;
  label: string;
  start_date: string;
  end_date: string;
  method: "ALL" | "BEST_X";
  cap_x: number | null;
  is_active: boolean;
};

type SeasonResp = { season?: SeasonMeta; leaderboard: LbRow[]; _error?: string };
type AllTimeResp = { leaderboard: LbRow[]; _error?: string };

/* ---------------- Helpers ---------------- */
function readParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
  fallback: string
) {
  const raw = Array.isArray(searchParams[key]) ? searchParams[key]?.[0] : searchParams[key];
  return raw !== undefined ? raw : fallback;
}

function parseParams(searchParams: Record<string, string | string[] | undefined>) {
  const scopeStr = readParam(searchParams, "scope", "season").toLowerCase();
  const typeStr = readParam(searchParams, "type", "npl").toLowerCase();
  const modeStr = readParam(searchParams, "mode", "simple").toLowerCase();

  const scope = (scopeStr === "all-time" ? "all-time" : "season") as "season" | "all-time";
  const type = (typeStr === "hrl" ? "hrl" : "npl") as "npl" | "hrl";
  const mode = (modeStr === "advanced" ? "advanced" : "simple") as "simple" | "advanced";

  const seasonId = readParam(searchParams, "seasonId", "current");

  const methodRaw = readParam(searchParams, "method", "BEST_X").toUpperCase();
  const methodParam = (methodRaw === "ALL" ? "ALL" : "BEST_X") as "ALL" | "BEST_X";
  const isUncapped = scope === "all-time" && methodParam === "ALL";

  const capParsed = Number(readParam(searchParams, "cap", "20"));
  const cap = Number.isFinite(capParsed) && capParsed > 0 ? Math.min(capParsed, 1000) : 20;

  const limitParsed = Number(readParam(searchParams, "limit", "100"));
  const limit = Number.isFinite(limitParsed) && limitParsed > 0 ? Math.min(limitParsed, 5000) : 100;

  // sorting
  const sort = readParam(searchParams, "sort", "position"); // position | name | total | lowest
  const dir = readParam(searchParams, "dir", "asc"); // asc | desc

  return { scope, type, mode, seasonId, methodParam, isUncapped, cap, limit, sort, dir };
}

async function baseUrl() {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host")) ?? "localhost:3000";
  const proto = (h.get("x-forwarded-proto") ?? "http");
  return `${proto}://${host}`;
}

async function fetchJSON<T>(path: string): Promise<T | null> {
  const res = await fetch(`${await baseUrl()}${path}`, { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

function cleanHref(params: Record<string, string | number | undefined>) {
  const clean: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(params)) if (v !== undefined) clean[k] = v as any;
  const usp = new URLSearchParams(clean as any).toString();
  return `/leaderboards?${usp}`;
}

function toggleDir(current: string) {
  return current === "asc" ? "desc" : "asc";
}

function parseResultsUsed(s: string): number {
  // "20 (27)" -> 20
  const m = /^(\d+)/.exec(s);
  if (!m) return 0;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : 0;
}

/* ---------------- Presentational (server-safe) ---------------- */
function SortLink({
  label,
  sortKey,
  currentSort,
  currentDir,
  params,
  alignRight,
}: {
  label: string;
  sortKey: string;
  currentSort: string;
  currentDir: string;
  params: any;
  alignRight?: boolean;
}) {
  const isActive = currentSort === sortKey;
  const dir = isActive ? toggleDir(currentDir) : "desc";
  const href = cleanHref({ ...params, sort: sortKey, dir });
  return (
    <a
      className={`hover:underline ${alignRight ? "text-right block" : ""} ${
        isActive ? "font-semibold" : ""
      }`}
      href={href}
      title={`Sort by ${label}`}
    >
      {label}
      {isActive ? (currentDir === "asc" ? " ▲" : " ▼") : ""}
    </a>
  );
}

function SimpleTable({
  rows,
  params,
  sort,
  dir,
}: {
  rows: LbRow[];
  params: any;
  sort: string;
  dir: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <thead>
          <tr>
            <th className="text-left w-14">
              <SortLink label="Pos" sortKey="position" currentSort={sort} currentDir={dir} params={params} />
            </th>
            <th className="text-left">
              <SortLink label="Player" sortKey="name" currentSort={sort} currentDir={dir} params={params} />
            </th>
            <th className="text-right">
              <SortLink label="Total" sortKey="total" currentSort={sort} currentDir={dir} params={params} alignRight />
            </th>
            <th className="text-right">
              <SortLink label="Results" sortKey="results" currentSort={sort} currentDir={dir} params={params} alignRight />
            </th>
            <th className="text-right">Avg</th>
            <th className="text-right">
              <SortLink label="Lowest" sortKey="lowest" currentSort={sort} currentDir={dir} params={params} alignRight />
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.player_id}>
              <td className="nums">{r.position}</td>
              <td>
                <a className="underline" href={`/players/${encodeURIComponent(r.player_id)}`}>
                  {r.name}
                </a>
              </td>
              <td className="text-right nums">{r.total_points.toFixed(2)}</td>
              <td className="text-right">{r.results_display}</td>
              <td className="text-right">{r.average_display}</td>
              <td className="text-right nums">{r.lowest_points.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdvancedTable({ rows, cap }: { rows: LbRow[]; cap: number }) {
  const capCols: number[] = [];
  for (let i = 1; i <= cap; i++) capCols.push(i);
  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <thead>
          <tr>
            <th className="text-left w-14">Pos</th>
            <th className="text-left">Player</th>
            <th className="text-right">Total</th>
            {capCols.map((i) => (
              <th key={i} className="text-right">{`R${i}`}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.player_id}>
              <td className="nums">{r.position}</td>
              <td>
                <a className="underline" href={`/players/${encodeURIComponent(r.player_id)}`}>
                  {r.name}
                </a>
              </td>
              <td className="text-right nums">{r.total_points.toFixed(2)}</td>
              {capCols.map((i) => {
                const val = r.top_results && r.top_results[i - 1];
                const hasVal = !(val === undefined || val === null);
                return (
                  <td key={i} className="text-right nums">
                    {hasVal ? (val as number).toFixed(2) : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Sorting (in-memory, server-side) ---------------- */
function sortRows(rows: LbRow[], sort: string, dir: string): LbRow[] {
  const copy = rows.slice();
  const asc = dir !== "desc";
  copy.sort((a, b) => {
    let av = 0;
    let bv = 0;

    if (sort === "position") {
      av = a.position; bv = b.position;
    } else if (sort === "name") {
      const an = a.name.toLowerCase();
      const bn = b.name.toLowerCase();
      if (an < bn) return asc ? -1 : 1;
      if (an > bn) return asc ? 1 : -1;
      return 0;
    } else if (sort === "total") {
      av = a.total_points; bv = b.total_points;
    } else if (sort === "lowest") {
      av = a.lowest_points; bv = b.lowest_points;
    } else if (sort === "results") {
      av = parseResultsUsed(a.results_display);
      bv = parseResultsUsed(b.results_display);
    } else {
      av = a.position; bv = b.position;
    }

    if (av < bv) return asc ? -1 : 1;
    if (av > bv) return asc ? 1 : -1;
    return 0;
  });
  return copy;
}

/* ---------------- Page ---------------- */
export default async function LeaderboardsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { scope, type, mode, seasonId, methodParam, isUncapped, cap, limit, sort, dir } =
    parseParams(searchParams);

  // seasons for selector (season scope only)
  const seasonsList = await fetchJSON<{ seasons: SeasonMeta[] }>("/api/seasons/list");
  const seasons =
    (seasonsList?.seasons ?? []).map((s) => ({
      id: String(s.id),
      label: s.label + (s.is_active ? " •" : ""),
    })) || [];

  // data fetch
  let data: SeasonResp | AllTimeResp | null = null;
  if (scope === "season") {
    data = await fetchJSON<SeasonResp>(
      `/api/leaderboards/season?type=${type}&mode=${mode}&seasonId=${seasonId}&limit=${limit}`
    );
  } else {
    if (isUncapped) {
      data = await fetchJSON<AllTimeResp>(
        `/api/leaderboards/all-time?type=${type}&mode=${mode}&method=ALL&limit=${limit}`
      );
    } else {
      data = await fetchJSON<AllTimeResp>(
        `/api/leaderboards/all-time?type=${type}&mode=${mode}&method=BEST_X&cap=${cap}&limit=${limit}`
      );
    }
  }

  const originalRows: LbRow[] = (data as any)?.leaderboard ?? [];
  const rows = sortRows(originalRows, sort, dir);

  const seasonMeta: SeasonMeta | null =
    scope === "season" && (data as SeasonResp)?.season ? ((data as SeasonResp).season as SeasonMeta) : null;

  const isCappedSeason = scope === "season" && seasonMeta?.method === "BEST_X";
  const effectiveCap = scope === "season"
    ? (seasonMeta?.cap_x ?? 0)
    : (isUncapped ? 0 : cap); // all-time: 0 when uncapped

  const title = scope === "season" && seasonMeta
    ? `Seasonal ${type.toUpperCase()} Leaderboard — ${seasonMeta.label}`
    : `All-Time ${type.toUpperCase()} Leaderboard`;

  // If user picked All-Time + Advanced + Uncapped → fallback to simple with a note
  const renderMode = scope === "all-time" && isUncapped && mode === "advanced" ? "simple" : mode;
  const showUncappedAdvancedNote = scope === "all-time" && isUncapped && mode === "advanced";

  // Right controls + CSV link
  const baseParams = { scope, type, mode, seasonId, method: isUncapped ? "ALL" : "BEST_X", cap, limit, sort, dir };
  const csvUrl =
    scope === "season"
      ? `/api/leaderboards/season?type=${type}&mode=${mode}&seasonId=${seasonId}&limit=${limit}&format=csv`
      : isUncapped
      ? `/api/leaderboards/all-time?type=${type}&mode=${mode}&method=ALL&limit=${limit}&format=csv`
      : `/api/leaderboards/all-time?type=${type}&mode=${mode}&method=BEST_X&cap=${cap}&limit=${limit}&format=csv`;

  const rightControls = (
    <div className="flex flex-wrap items-center gap-2">
      {/* Scope */}
      <span className="text-neutral-600">Scope:</span>
      <a
        className={`underline ${scope === "season" ? "font-semibold" : ""}`}
        href={cleanHref({ ...baseParams, scope: "season" })}
      >
        Season
      </a>
      <a
        className={`underline ${scope === "all-time" ? "font-semibold" : ""}`}
        href={cleanHref({ ...baseParams, scope: "all-time" })}
      >
        All-Time
      </a>

      {/* Type */}
      <span className="text-neutral-600 ml-3">League:</span>
      <a
        className={`underline ${type === "npl" ? "font-semibold" : ""}`}
        href={cleanHref({ ...baseParams, type: "npl" })}
      >
        NPL
      </a>
      <a
        className={`underline ${type === "hrl" ? "font-semibold" : ""}`}
        href={cleanHref({ ...baseParams, type: "hrl" })}
      >
        HRL
      </a>

      {/* Mode */}
      <span className="text-neutral-600 ml-3">View:</span>
      <a
        className={`underline ${mode === "simple" ? "font-semibold" : ""}`}
        href={cleanHref({ ...baseParams, mode: "simple" })}
      >
        Simple
      </a>
      <a
        className={`underline ${mode === "advanced" ? "font-semibold" : ""}`}
        href={cleanHref({ ...baseParams, mode: "advanced" })}
      >
        Advanced
      </a>

      {/* Seasons (only for seasonal scope) */}
      {scope === "season" && (
        <>
          <span className="text-neutral-600 ml-3">Season:</span>
          <a
            className={`underline ${seasonId === "current" ? "font-semibold" : ""}`}
            href={cleanHref({ ...baseParams, seasonId: "current" })}
          >
            Current
          </a>
          {seasons.map((s) => (
            <a
              key={s.id}
              className={`underline ${String(seasonId) === s.id ? "font-semibold" : ""}`}
              href={cleanHref({ ...baseParams, seasonId: s.id })}
            >
              {s.label}
            </a>
          ))}
        </>
      )}

      {/* Caps (All-Time only) */}
      {scope === "all-time" && (
        <>
          <span className="text-neutral-600 ml-3">Cap:</span>
          <a
            className={`underline ${isUncapped ? "font-semibold" : ""}`}
            href={cleanHref({ ...baseParams, method: "ALL" })}
          >
            Uncapped
          </a>
          {[10, 20, 30].map((c) => (
            <a
              key={c}
              className={`underline ${!isUncapped && cap === c ? "font-semibold" : ""}`}
              href={cleanHref({ ...baseParams, method: "BEST_X", cap: c })}
            >
              {c}
            </a>
          ))}
        </>
      )}

      {/* Limit */}
      <span className="text-neutral-600 ml-3">Limit:</span>
      {[50, 100, 200].map((n) => (
        <a
          key={n}
          className={`underline ${limit === n ? "font-semibold" : ""}`}
          href={cleanHref({ ...baseParams, limit: n })}
        >
          {n}
        </a>
      ))}

      {/* CSV */}
      <span className="mx-2 opacity-50">•</span>
      <a className="underline" href={csvUrl}>Export CSV</a>
    </div>
  );

  return (
    <div className="space-y-6">
      <section className="card overflow-hidden">
        <div className="card-header flex flex-wrap items-center justify-between gap-2">
          <div>
            {scope === "season" && seasonMeta
              ? `Seasonal ${type.toUpperCase()} Leaderboard — ${seasonMeta.label}`
              : `All-Time ${type.toUpperCase()} Leaderboard`}
          </div>
          {rightControls}
        </div>
        <div className="card-body">
          {!rows.length ? (
            <div className="text-sm text-neutral-600">No data yet.</div>
          ) : renderMode === "advanced" ? (
            <AdvancedTable rows={rows} cap={effectiveCap || 0} />
          ) : (
            <SimpleTable rows={rows} params={baseParams} sort={sort} dir={dir} />
          )}

          {/* Helper text */}
          {scope === "season" && isCappedSeason && renderMode === "simple" && (
            <p className="mt-2 text-xs text-neutral-500">
              “Results” shows <b>used</b> results first, then total in brackets (e.g., <code>20 (27)</code>). “Avg” shows used average (total average in brackets).
            </p>
          )}
          {scope === "all-time" && !isUncapped && (
            <p className="mt-2 text-xs text-neutral-500">
              Showing <b>Best {cap}</b> results (change the cap above).
            </p>
          )}
          {scope === "all-time" && isUncapped && (
            <p className="mt-2 text-xs text-neutral-500">
              Showing <b>all results</b> (choose a numeric cap above for BEST-X).
            </p>
          )}
          {showUncappedAdvancedNote && (
            <p className="mt-2 text-xs text-amber-600">
              Advanced view requires a numeric cap. Showing Simple view instead.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
