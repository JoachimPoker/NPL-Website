// src/app/leaderboards/page.tsx
import { headers } from "next/headers";
import Link from "next/link";

export const runtime = "nodejs";
export const revalidate = 0;

/* ---------- Types matching /api/leaderboards/season ---------- */
type MetaSeason = {
  id: number;
  label: string;
  start_date: string;
  end_date: string;
  method: "ALL" | "BEST_X";
  cap_x: number | null;
  is_active: boolean;
};

type Row = {
  position: number;
  player_id: string;
  display_name: string;
  total_points: number;
  used_count: number;
  total_count: number;
  average_used: number;
  average_all: number;
  best_single: number;
  lowest_counted: number | null;
  top3_count: number;
  top9_count: number;
  wins: number;
};

type SuccessResp = {
  ok: true;
  meta: {
    league: "npl" | "hrl";
    season: MetaSeason;
    limit: number;
    offset: number;
    total_hint?: number;
  };
  rows: Row[];
};

type ErrorResp = { ok: false; error: string };
type ApiResp = SuccessResp | ErrorResp;

/* ---------- Helpers ---------- */
async function baseUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

function qs(obj: Record<string, string | number | undefined | null>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === "") continue;
    p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

function fmt(v: number | null | undefined) {
  if (v === null || v === undefined) return "—";
  return v.toFixed(2);
}

function isSuccess(x: unknown): x is SuccessResp {
  return !!x && typeof x === "object" && (x as any).ok === true && Array.isArray((x as any).rows);
}

/* ---------- Server page (await searchParams) ---------- */
export default async function LeaderboardsPage({
  searchParams,
}: {
  // Next 15: searchParams is async
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const spRaw = await searchParams;
  const sp = Object.fromEntries(
    Object.entries(spRaw ?? {}).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])
  );

  // defaults
  const league = (sp.league === "hrl" ? "hrl" : "npl") as "npl" | "hrl";
  const seasonId = sp.seasonId || "current";
  const method =
    sp.method?.toUpperCase() === "BEST_X"
      ? "BEST_X"
      : sp.method?.toUpperCase() === "ALL"
      ? "ALL"
      : undefined;
  const cap = sp.cap ? Number(sp.cap) : undefined;
  const q = (sp.q || sp.search || "").trim();
  const pageSize = Math.min(500, Math.max(10, Number(sp.limit ?? 100)));
  const page = Math.max(1, Number(sp.page ?? 1));
  const offset = (page - 1) * pageSize;

  // Build API query
  const apiParams: Record<string, string | number | undefined> = {
    league,
    seasonId,
    limit: pageSize,
    offset,
    q: q || undefined,
    method,
    cap: method === "BEST_X" ? cap : undefined,
  };
  const apiUrl = `${await baseUrl()}/api/leaderboards/season${qs(apiParams)}`;

  const res = await fetch(apiUrl, { cache: "no-store" });
  const data = (await res.json()) as ApiResp;

  if (!res.ok || !isSuccess(data)) {
    const msg = (!res.ok ? res.statusText : (data as ErrorResp).error) || "Unknown error";
    return (
      <div className="space-y-6">
        <section className="card">
          <div className="card-header"><h1 className="text-2xl font-semibold">Leaderboards</h1></div>
          <div className="card-body">
            <div className="p-2 rounded bg-red-100 text-red-700 text-sm">
              Failed to load leaderboard: {msg}
            </div>
          </div>
        </section>
      </div>
    );
  }

  const meta = data.meta;
  const rows = data.rows;
  const hasPrev = page > 1;
  const hasNext = rows.length === pageSize; // optimistic; no exact total needed

  // helpers to build navigation/search URLs
  const baseParams = {
    seasonId,
    q: q || undefined,
    method: method || undefined,
    cap: method === "BEST_X" ? (cap ?? meta.season.cap_x ?? undefined) : undefined,
    limit: pageSize,
  };

  const makeUrl = (extra: Record<string, string | number | undefined>) =>
    `/leaderboards${qs({ ...baseParams, league, ...extra })}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="card">
        <div
          className="card-header flex items-center justify-between"
        >
          <div>
            <h1 className="text-2xl font-semibold">Leaderboards</h1>
            <div className="text-sm text-neutral-600 mt-1">
              Season: <b>{meta.season.label}</b> &middot; {meta.season.start_date} → {meta.season.end_date}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              className={`rounded-md border px-3 py-1.5 text-sm ${league === "npl" ? "bg-neutral-100" : ""}`}
              href={`/leaderboards${qs({ ...baseParams, league: "npl", page: 1 })}`}
            >
              NPL
            </Link>
            <Link
              className={`rounded-md border px-3 py-1.5 text-sm ${league === "hrl" ? "bg-neutral-100" : ""}`}
              href={`/leaderboards${qs({ ...baseParams, league: "hrl", page: 1 })}`}
            >
              High Roller League
            </Link>
          </div>
        </div>

        {/* Controls */}
        <div className="card-body space-y-3">
          <form action="/leaderboards" method="get" className="grid md:grid-cols-4 gap-3">
            {/* keep params when submitting */}
            <input type="hidden" name="league" value={league} />
            <input type="hidden" name="seasonId" value={seasonId} />
            <input type="hidden" name="limit" value={pageSize} />

            <div className="md:col-span-2">
              <label className="block text-sm text-neutral-600">Search players</label>
              <input
                className="w-full border rounded px-2 py-1"
                name="q"
                defaultValue={q}
                placeholder="Name or alias…"
              />
            </div>

            <div>
              <label className="block text-sm text-neutral-600">Method</label>
              <select className="w-full border rounded px-2 py-1" name="method" defaultValue={method ?? meta.season.method}>
                <option value="ALL">ALL</option>
                <option value="BEST_X">BEST_X</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-neutral-600">Cap (for BEST_X)</label>
              <input
                className="w-full border rounded px-2 py-1"
                name="cap"
                type="number"
                min={0}
                defaultValue={
                  method === "BEST_X"
                    ? (cap ?? meta.season.cap_x ?? 0)
                    : meta.season.method === "BEST_X"
                    ? (meta.season.cap_x ?? 0)
                    : 0
                }
              />
            </div>

            <div className="md:col-span-4 flex items-center gap-2">
              <label className="text-sm">Page size:</label>
              <select className="border rounded px-2 py-1 text-sm" name="limit" defaultValue={pageSize}>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
              </select>

              <button className="rounded-md border px-3 py-1.5 text-sm" type="submit">
                Apply
              </button>

              {/* Reset search (preserve league & seasonId) */}
              {q && (
                <Link
                  className="rounded-md border px-3 py-1.5 text-sm"
                  href={`/leaderboards${qs({ ...baseParams, q: undefined, page: 1, league })}`}
                >
                  Clear search
                </Link>
              )}
            </div>
          </form>
        </div>
      </section>

      {/* Table */}
      <section className="card overflow-hidden">
        <div className="card-header flex items-center justify-between">
          <b>{league === "npl" ? "National Poker League" : "High Roller League"} — {meta.season.label}</b>
          <div className="flex items-center gap-2 text-sm">
            <span>Method:&nbsp;<b>{(sp.method?.toUpperCase() as "ALL" | "BEST_X") || meta.season.method}</b></span>
            {(sp.method?.toUpperCase() === "BEST_X" || meta.season.method === "BEST_X") && (
              <span>Cap:&nbsp;<b>{sp.cap ?? meta.season.cap_x ?? 0}</b></span>
            )}
          </div>
        </div>
        <div className="card-body">
          {!rows.length ? (
            <div className="text-sm text-neutral-600">No results.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="text-left w-16">Pos</th>
                    <th className="text-left">Player</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Used</th>
                    <th className="text-right">All</th>
                    <th className="text-right">Avg (used)</th>
                    <th className="text-right">Avg (all)</th>
                    <th className="text-right">Best</th>
                    <th className="text-right">Lowest</th>
                    <th className="text-right">Wins</th>
                    <th className="text-right">Top-3</th>
                    <th className="text-right">Top-9</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: Row) => (
                    <tr key={r.player_id}>
                      <td className="nums">{r.position}</td>
                      <td>
                        <Link className="underline" href={`/players/${encodeURIComponent(r.player_id)}`}>
                          {r.display_name}
                        </Link>
                      </td>
                      <td className="text-right">{fmt(r.total_points)}</td>
                      <td className="text-right">{r.used_count}</td>
                      <td className="text-right">{r.total_count}</td>
                      <td className="text-right">{fmt(r.average_used)}</td>
                      <td className="text-right">{fmt(r.average_all)}</td>
                      <td className="text-right">{fmt(r.best_single)}</td>
                      <td className="text-right">{fmt(r.lowest_counted)}</td>
                      <td className="text-right">{r.wins}</td>
                      <td className="text-right">{r.top3_count}</td>
                      <td className="text-right">{r.top9_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="card-footer flex items-center justify-between px-4 py-3">
          <Link
            className={`rounded-md border px-3 py-1 ${page > 1 ? "" : "pointer-events-none opacity-50"}`}
            href={page > 1 ? makeUrl({ page: page - 1 }) : "#"}
          >
            ← Prev
          </Link>
          <div className="text-sm">Page {page}</div>
          <Link
            className={`rounded-md border px-3 py-1 ${rows.length === pageSize ? "" : "pointer-events-none opacity-50"}`}
            href={rows.length === pageSize ? makeUrl({ page: page + 1 }) : "#"}
          >
            Next →
          </Link>
        </div>
      </section>
    </div>
  );
}
