// src/app/events/[seriesId]/page.tsx
import { headers } from "next/headers";

export const runtime = "nodejs";
export const revalidate = 0;

/* ---------- UI types ---------- */
type LbRow = {
  position: number;
  player_id: string;
  name: string;
  total_points: number;
  results_display: string;
  average_display: string;
  lowest_points: number;
  top_results?: number[];
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
type SeriesMeta = { id: string; label: string };

type Festival = {
  id: string;
  label: string;
  start_date?: string | null;
  end_date?: string | null;
};
type EventRow = {
  id: string;
  name: string;
  date?: string | null;
  venue?: string | null;
  is_high_roller?: boolean;
};

/* ---------- helpers ---------- */
async function baseUrl() {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host")) ?? "localhost:3000";
  const proto = (h.get("x-forwarded-proto") ?? "http");
  return `${proto}://${host}`;
}

/** Try multiple candidate paths until one returns JSON (with debug logging). */
async function fetchFirst<T>(
  paths: string[],
  debugArr: Array<{ kind: string; url: string; ok: boolean; sample?: string }>,
  kind: string
): Promise<T | null> {
  for (const p of paths) {
    const res = await fetch(`${await baseUrl()}${p}`, { cache: "no-store" });
    const ok = res.ok;
    let json: any = null;
    try {
      json = await res.json();
    } catch {
      // ignore parse error
    }
    debugArr.push({
      kind,
      url: p,
      ok,
      sample: ok && json ? JSON.stringify(Object.keys(json)).slice(0, 120) : undefined,
    });
    if (ok && json) return json as T;
  }
  return null;
}

function readParam(
  sp: Record<string, string | string[] | undefined>,
  key: string,
  def: string
) {
  const raw = Array.isArray(sp[key]) ? sp[key]?.[0] : sp[key];
  return raw !== undefined ? raw : def;
}

function cleanHref(
  seriesId: string,
  params: Record<string, string | number | undefined>
) {
  const clean: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(params)) if (v !== undefined) clean[k] = v as any;
  const qs = new URLSearchParams(clean as any).toString();
  return `/events/${encodeURIComponent(seriesId)}?${qs}`;
}

/* ---------- normalizers ---------- */
function normalizeLbRows(resp: any): { series?: SeriesMeta; rows: LbRow[] } {
  const seriesRaw = resp?.series ?? resp?.meta ?? undefined;
  const series: SeriesMeta | undefined = seriesRaw
    ? {
        id: String(seriesRaw.id ?? seriesRaw.series_id ?? seriesRaw.slug ?? ""),
        label: String(seriesRaw.label ?? seriesRaw.name ?? `Series`),
      }
    : undefined;

  const arr: any[] =
    (Array.isArray(resp?.leaderboard) ? resp.leaderboard : undefined) ??
    (Array.isArray(resp?.rows) ? resp.rows : undefined) ??
    (Array.isArray(resp?.data) ? resp.data : undefined) ??
    (Array.isArray(resp) ? resp : []) ??
    [];

  const rows: LbRow[] = arr.map((r: any, i: number) => {
    const used =
      Number(
        r.used_results ?? r.results_used ?? r.used ?? r.usedCount ?? r.results ?? 0
      ) || 0;
    const total =
      Number(
        r.total_results ??
          r.results_total ??
          r.total ??
          r.totalCount ??
          r.all_results ??
          used
      ) || used;

    const fmt = (v: any) =>
      typeof v === "number" && Number.isFinite(v) ? v.toFixed(2) : String(v ?? "");

    const average_display =
      typeof r.average_display === "string"
        ? r.average_display
        : total && used && total !== used
        ? `${fmt(r.avg_used ?? r.avg_points ?? r.average ?? 0)} (${fmt(
            r.avg_all ?? r.avg_total ?? r.overall_average ?? 0
          )})`
        : fmt(r.avg_points ?? r.average ?? r.avg ?? 0);

    const results_display =
      typeof r.results_display === "string"
        ? r.results_display
        : total && used
        ? `${used} (${total})`
        : String(used || total || "");

    return {
      position: Number(r.position ?? r.rank ?? i + 1) || i + 1,
      player_id: String(r.player_id ?? r.id ?? r.playerId ?? ""),
      name: String(r.name ?? r.player_name ?? r.display_name ?? "Player"),
      total_points: Number(r.total_points ?? r.total ?? r.points ?? r.sum ?? 0) || 0,
      results_display,
      average_display,
      lowest_points: Number(r.lowest_points ?? r.lowest ?? r.min ?? 0) || 0,
      top_results: Array.isArray(r.top_results) ? r.top_results : undefined,
    };
  });

  return { series, rows };
}

function normalizeSeasons(resp: any): SeasonMeta[] {
  const arr: any[] =
    (Array.isArray(resp?.seasons) ? resp.seasons : undefined) ??
    (Array.isArray(resp) ? resp : []) ??
    [];
  return arr.map((s) => ({
    id: Number(s.id ?? s.season_id ?? 0),
    label: String(s.label ?? s.name ?? s.title ?? ""),
    start_date: String(s.start_date ?? s.start ?? ""),
    end_date: String(s.end_date ?? s.end ?? ""),
    method: (String(s.method ?? s.scoring_method ?? "BEST_X").toUpperCase() as any) ?? "BEST_X",
    cap_x: (s.cap_x ?? s.cap ?? s.best_x ?? null) as number | null,
    is_active: Boolean(s.is_active ?? s.active ?? s.current ?? false),
  }));
}

function normalizeFestivals(resp: any): Festival[] {
  const arr: any[] =
    (Array.isArray(resp?.festivals) ? resp.festivals : undefined) ??
    (Array.isArray(resp) ? resp : []) ??
    [];
  return arr.map((f) => ({
    id: String(f.id ?? f.festival_id ?? f.slug ?? ""),
    label: String(f.label ?? f.name ?? f.title ?? "Festival"),
    start_date:
      typeof f.start_date === "string"
        ? f.start_date
        : typeof f.date_from === "string"
        ? f.date_from
        : null,
    end_date:
      typeof f.end_date === "string"
        ? f.end_date
        : typeof f.date_to === "string"
        ? f.date_to
        : null,
  }));
}

function normalizeEvents(resp: any): EventRow[] {
  const arr: any[] =
    (Array.isArray(resp?.events) ? resp.events : undefined) ??
    (Array.isArray(resp) ? resp : []) ??
    [];
  return arr.map((e) => ({
    id: String(e.id ?? e.event_id ?? ""),
    name: String(e.name ?? e.event_name ?? "Event"),
    date:
      typeof e.date === "string"
        ? e.date
        : typeof e.event_date === "string"
        ? e.event_date
        : null,
    venue:
      typeof e.venue === "string"
        ? e.venue
        : typeof e.location === "string"
        ? e.location
        : null,
    is_high_roller: Boolean(e.is_high_roller ?? e.is_hrl ?? e.hrl ?? false),
  }));
}

/* ---------- table ---------- */
function SimpleTable({ rows }: { rows: LbRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <thead>
          <tr>
            <th className="text-left w-14">Pos</th>
            <th className="text-left">Player</th>
            <th className="text-right">Total</th>
            <th className="text-right">Results</th>
            <th className="text-right">Avg</th>
            <th className="text-right">Lowest</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.player_id}>
              <td className="nums">{r.position}</td>
              <td>
                <a
                  className="underline"
                  href={`/players/${encodeURIComponent(r.player_id)}`}
                >
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

/* ---------- page ---------- */
export default async function SeriesPage({
  params,
  searchParams,
}: {
  params: { seriesId: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { seriesId } = params;

  const scopeStr = readParam(searchParams, "scope", "season").toLowerCase(); // season | all-time
  const typeStr = readParam(searchParams, "type", "npl").toLowerCase(); // npl | hrl
  const modeStr = readParam(searchParams, "mode", "simple").toLowerCase(); // simple | advanced
  const seasonId = readParam(searchParams, "seasonId", "current");
  const capNum = Number(readParam(searchParams, "cap", "20"));
  const limitNum = Number(readParam(searchParams, "limit", "100"));
  const debugOn = readParam(searchParams, "debug", "0") === "1";

  const scope = scopeStr === "all-time" ? "all-time" : "season";
  const type = (typeStr === "hrl" ? "hrl" : "npl") as "npl" | "hrl";
  const mode = (modeStr === "advanced" ? "advanced" : "simple") as
    | "simple"
    | "advanced";
  const cap = Number.isFinite(capNum) && capNum > 0 ? Math.min(capNum, 1000) : 20;
  const limit =
    Number.isFinite(limitNum) && limitNum > 0 ? Math.min(limitNum, 5000) : 100;

  const debug: Array<{ kind: string; url: string; ok: boolean; sample?: string }> =
    [];

  // seasons list (for season scope)
  const seasonsResp = await fetchFirst<{ seasons: SeasonMeta[] }>(
    ["/api/seasons/list", "/api/admin/seasons/list"],
    debug,
    "seasons"
  );
  const seasons = seasonsResp ? normalizeSeasons(seasonsResp) : [];

  // ----- leaderboard candidates -----
  const lbCandidates: string[] = [];
  const sid = encodeURIComponent(seriesId);

  if (scope === "season") {
    const sidSeason = encodeURIComponent(seasonId);
    lbCandidates.push(
      // explicit series leaderboard
      `/api/leaderboards/series?seriesId=${sid}&scope=season&type=${type}&mode=${mode}&seasonId=${sidSeason}&limit=${limit}`,
      `/api/leaderboards/series?id=${sid}&scope=season&type=${type}&mode=${mode}&seasonId=${sidSeason}&limit=${limit}`,
      `/api/series/${sid}/leaderboard?scope=season&type=${type}&mode=${mode}&seasonId=${sidSeason}&limit=${limit}`,
      `/api/series/leaderboard?seriesId=${sid}&scope=season&type=${type}&mode=${mode}&seasonId=${sidSeason}&limit=${limit}`,
      `/api/leaderboards/series/${sid}?scope=season&type=${type}&mode=${mode}&seasonId=${sidSeason}&limit=${limit}`,

      // piggy-back on your existing season endpoint with series filter variants
      `/api/leaderboards/season?type=${type}&mode=${mode}&seasonId=${sidSeason}&seriesId=${sid}&limit=${limit}`,
      `/api/leaderboards/season?type=${type}&mode=${mode}&seasonId=${sidSeason}&series=${sid}&limit=${limit}`,
      `/api/leaderboards/season?type=${type}&mode=${mode}&seasonId=${sidSeason}&series_id=${sid}&limit=${limit}`
    );
  } else {
    lbCandidates.push(
      // explicit series all-time leaderboard
      `/api/leaderboards/series?seriesId=${sid}&scope=all-time&type=${type}&mode=${mode}&cap=${cap}&limit=${limit}`,
      `/api/leaderboards/series?id=${sid}&scope=all-time&type=${type}&mode=${mode}&cap=${cap}&limit=${limit}`,
      `/api/series/${sid}/leaderboard?scope=all-time&type=${type}&mode=${mode}&cap=${cap}&limit=${limit}`,
      `/api/series/leaderboard?seriesId=${sid}&scope=all-time&type=${type}&mode=${mode}&cap=${cap}&limit=${limit}`,
      `/api/leaderboards/series/${sid}?scope=all-time&type=${type}&mode=${mode}&cap=${cap}&limit=${limit}`,

      // piggy-back on your existing all-time endpoint with series filters
      `/api/leaderboards/all-time?type=${type}&mode=${mode}&method=BEST_X&cap=${cap}&seriesId=${sid}&limit=${limit}`,
      `/api/leaderboards/all-time?type=${type}&mode=${mode}&method=BEST_X&cap=${cap}&series=${sid}&limit=${limit}`,
      `/api/leaderboards/all-time?type=${type}&mode=${mode}&method=BEST_X&cap=${cap}&series_id=${sid}&limit=${limit}`
    );
  }

  const lbResp = await fetchFirst<any>(lbCandidates, debug, "series-leaderboard");
  const { series: seriesMetaFromResp, rows } = lbResp
    ? normalizeLbRows(lbResp)
    : { series: undefined, rows: [] };
  const seriesMeta: SeriesMeta =
    seriesMetaFromResp ?? { id: seriesId, label: `Series ${seriesId}` };

  // ----- festivals list candidates -----
  const festResp = await fetchFirst<any>(
    [
      `/api/festivals/list?seriesId=${sid}`,
      `/api/festivals?seriesId=${sid}`,
      `/api/festivals/list?series=${sid}`,
      `/api/festivals/list?series_id=${sid}`,
      `/api/series/${sid}/festivals`,
      `/api/admin/festivals/list?seriesId=${sid}`,
    ],
    debug,
    "festivals"
  );
  const festivals = festResp ? normalizeFestivals(festResp) : [];

  // Fallback: if no festivals, fetch events by series
  let events: EventRow[] = [];
  if (festivals.length === 0) {
    const seriesEvents = await fetchFirst<any>(
      [
        `/api/events/list?seriesId=${sid}`,
        `/api/events/list?series=${sid}`,
        `/api/events/list?series_id=${sid}`,
        `/api/events?seriesId=${sid}`,
        `/api/events?series=${sid}`,
        `/api/events?series_id=${sid}`,
        `/api/series/${sid}/events`,
        `/api/admin/events/list?seriesId=${sid}`,
      ],
      debug,
      "series-events"
    );
    events = seriesEvents ? normalizeEvents(seriesEvents) : [];
  }

  const rightControls = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-neutral-600">Scope:</span>
      <a
        className={`underline ${scope === "season" ? "font-semibold" : ""}`}
        href={cleanHref(seriesId, {
          scope: "season",
          type,
          mode,
          seasonId,
          limit,
          debug: debugOn ? 1 : undefined,
        })}
      >
        Season
      </a>
      <a
        className={`underline ${scope === "all-time" ? "font-semibold" : ""}`}
        href={cleanHref(seriesId, {
          scope: "all-time",
          type,
          mode,
          cap,
          limit,
          debug: debugOn ? 1 : undefined,
        })}
      >
        All-Time
      </a>

      <span className="text-neutral-600 ml-3">League:</span>
      <a
        className={`underline ${type === "npl" ? "font-semibold" : ""}`}
        href={cleanHref(seriesId, {
          scope,
          type: "npl",
          mode,
          seasonId,
          cap,
          limit,
          debug: debugOn ? 1 : undefined,
        })}
      >
        NPL
      </a>
      <a
        className={`underline ${type === "hrl" ? "font-semibold" : ""}`}
        href={cleanHref(seriesId, {
          scope,
          type: "hrl",
          mode,
          seasonId,
          cap,
          limit,
          debug: debugOn ? 1 : undefined,
        })}
      >
        HRL
      </a>

      <span className="text-neutral-600 ml-3">View:</span>
      <a
        className={`underline ${mode === "simple" ? "font-semibold" : ""}`}
        href={cleanHref(seriesId, {
          scope,
          type,
          mode: "simple",
          seasonId,
          cap,
          limit,
          debug: debugOn ? 1 : undefined,
        })}
      >
        Simple
      </a>
      <a
        className={`underline ${mode === "advanced" ? "font-semibold" : ""}`}
        href={cleanHref(seriesId, {
          scope,
          type,
          mode: "advanced",
          seasonId,
          cap,
          limit,
          debug: debugOn ? 1 : undefined,
        })}
      >
        Advanced
      </a>

      {scope === "season" && (
        <>
          <span className="text-neutral-600 ml-3">Season:</span>
          <a
            className={`underline ${seasonId === "current" ? "font-semibold" : ""}`}
            href={cleanHref(seriesId, {
              scope,
              type,
              mode,
              seasonId: "current",
              limit,
              debug: debugOn ? 1 : undefined,
            })}
          >
            Current
          </a>
          {seasons.map((s) => (
            <a
              key={s.id}
              className={`underline ${
                String(seasonId) === String(s.id) ? "font-semibold" : ""
              }`}
              href={cleanHref(seriesId, {
                scope,
                type,
                mode,
                seasonId: s.id,
                limit,
                debug: debugOn ? 1 : undefined,
              })}
            >
              {s.label}
              {s.is_active ? " •" : ""}
            </a>
          ))}
        </>
      )}

      {scope === "all-time" && (
        <>
          <span className="text-neutral-600 ml-3">Cap:</span>
          {[10, 20, 30].map((c) => (
            <a
              key={c}
              className={`underline ${cap === c ? "font-semibold" : ""}`}
              href={cleanHref(seriesId, {
                scope,
                type,
                mode,
                cap: c,
                limit,
                debug: debugOn ? 1 : undefined,
              })}
            >
              {c}
            </a>
          ))}
        </>
      )}

      <span className="text-neutral-600 ml-3">Limit:</span>
      {[50, 100, 200].map((n) => (
        <a
          key={n}
          className={`underline ${limit === n ? "font-semibold" : ""}`}
          href={cleanHref(seriesId, {
            scope,
            type,
            mode,
            seasonId,
            cap,
            limit: n,
            debug: debugOn ? 1 : undefined,
          })}
        >
          {n}
        </a>
      ))}

      {debugOn ? (
        <span className="ml-3 text-xs px-2 py-0.5 rounded border">debug</span>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Leaderboard */}
      <section className="card overflow-hidden">
        <div className="card-header flex flex-wrap items-center justify-between gap-2">
          <div>
            { /* fallback name if API doesn't provide */ }
            Series {seriesId} — {type.toUpperCase()} Leaderboard
          </div>
          {rightControls}
        </div>
        <div className="card-body">
          {!rows.length ? (
            <div className="text-sm text-neutral-600">No data for this series yet.</div>
          ) : (
            <SimpleTable rows={rows} />
          )}
          {scope === "all-time" && (
            <p className="mt-2 text-xs text-neutral-500">
              Showing <b>Best {cap}</b> results (adjust cap above).
            </p>
          )}
        </div>
      </section>

      {/* Festivals or fallback events */}
      {festivals.length > 0 ? (
        <section className="card overflow-hidden">
          <div className="card-header">Festivals in this series</div>
          <div className="card-body">
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {festivals.map((f) => (
                <li key={f.id} className="card p-4">
                  <div className="font-semibold">
                    <a
                      className="underline"
                      href={`/events/${encodeURIComponent(seriesId)}/${encodeURIComponent(f.id)}`}
                    >
                      {f.label}
                    </a>
                  </div>
                  <div className="text-sm text-neutral-600 mt-1">
                    {f.start_date ? f.start_date : ""}
                    {f.end_date ? ` → ${f.end_date}` : ""}
                  </div>
                  <div className="mt-3 text-sm">
                    <a
                      className="underline"
                      href={`/events/${encodeURIComponent(seriesId)}/${encodeURIComponent(f.id)}`}
                    >
                      View events →
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : (
        <section className="card overflow-x-auto">
          <div className="card-header">Events in this series</div>
          {!events.length ? (
            <div className="card-body text-sm text-neutral-600">No events recorded.</div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th className="text-left">Date</th>
                  <th className="text-left">Event</th>
                  <th className="text-left">Venue</th>
                  <th className="text-left">League</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td>{e.date ?? "—"}</td>
                    <td>
                      <a className="underline" href={`/events/${encodeURIComponent(e.id)}`}>
                        {e.name}
                      </a>
                    </td>
                    <td>{e.venue ?? ""}</td>
                    <td>
                      <span className={`badge ${e.is_high_roller ? "badge-hrl" : "badge-npl"}`}>
                        {e.is_high_roller ? "HRL" : "NPL"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* Debug panel */}
      {debugOn ? (
        <section className="card p-4">
          <div className="font-semibold mb-2">Debug</div>
          <ul className="text-xs space-y-1">
            {debug.map((d, i) => (
              <li key={i}>
                <span className={`inline-block w-28 ${d.ok ? "text-green-500" : "text-red-500"}`}>
                  {d.ok ? "OK" : "FAIL"}
                </span>
                <span className="inline-block w-36 text-neutral-500">{d.kind}</span>
                <code className="break-all">{d.url}</code>
                {d.sample ? (
                  <span className="ml-2 text-neutral-500">keys: {d.sample}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="text-sm">
        <a className="underline" href="/events">
          ← Back to Events overview
        </a>
      </div>
    </div>
  );
}
