// src/app/page.tsx
import { headers } from "next/headers";

export const runtime = "nodejs";
export const revalidate = 0;

/* ---------- Types aligned to your existing APIs ---------- */
type LbRow = {
  position: number;
  player_id: string;
  name: string;
  total_points: number;
  results_display: string;  // e.g. "20 (27)"
  average_display: string;  // e.g. "18.23 (16.10)"
  lowest_points: number;
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

type SeasonListResp = { seasons: SeasonMeta[] };
type SeasonLbResp = { season?: SeasonMeta; leaderboard: LbRow[]; _error?: string };

/* ---------- Helpers ---------- */
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

function lbHref(params: Record<string, string | number>) {
  const usp = new URLSearchParams(params as any).toString();
  return `/leaderboards?${usp}`;
}

/* ---------- Tiny presentational helpers (server-safe) ---------- */
function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-2xl font-semibold nums">{value}</div>
      {hint ? <div className="text-xs text-neutral-500 mt-1">{hint}</div> : null}
    </div>
  );
}

function Table({
  head,
  children,
}: {
  head: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <thead>
          <tr>{head}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function SimpleRows({ rows }: { rows: LbRow[] }) {
  return (
    <>
      {rows.map((r) => (
        <tr key={r.player_id}>
          <td className="w-14 nums">{r.position}</td>
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
    </>
  );
}

/* ---------- Page ---------- */
export default async function HomePage() {
  const seasonsList = await fetchJSON<SeasonListResp>("/api/seasons/list");
  const seasons = seasonsList?.seasons ?? [];
  const activeSeason = seasons.find((s) => s.is_active === true);

  const [npl, hrl] = await Promise.all([
    fetchJSON<SeasonLbResp>("/api/leaderboards/season?type=npl&mode=simple&seasonId=current&limit=10"),
    fetchJSON<SeasonLbResp>("/api/leaderboards/season?type=hrl&mode=simple&seasonId=current&limit=10"),
  ]);

  const updatedAt = new Date().toLocaleString();

  // Derive some KPI values step-by-step (no ??/|| mixing)
  const nplTop = npl?.leaderboard && npl.leaderboard.length > 0 ? npl.leaderboard[0] : undefined;
  const nplTopTotal = nplTop ? nplTop.total_points.toFixed(2) : "—";

  const hrlTop = hrl?.leaderboard && hrl.leaderboard.length > 0 ? hrl.leaderboard[0] : undefined;
  const hrlTopTotal = hrlTop ? hrlTop.total_points.toFixed(2) : "—";

  let methodLabel = "—";
  if (activeSeason?.method === "BEST_X") {
    const capStr = activeSeason.cap_x !== null && activeSeason.cap_x !== undefined
      ? String(activeSeason.cap_x)
      : "X";
    methodLabel = `BEST-${capStr}`;
  } else if (activeSeason?.method === "ALL") {
    methodLabel = "ALL";
  }

  const dateRange =
    activeSeason?.start_date && activeSeason?.end_date
      ? `${activeSeason.start_date} → ${activeSeason.end_date}`
      : undefined;

  return (
    <div className="space-y-6">
      {/* Hero / KPIs */}
      <section className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-8 card p-4">
          <h1>National Poker League</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Current Season: <b>{activeSeason?.label ?? "—"}</b>
            {dateRange ? ` · ${dateRange}` : ""}
          </p>
          <p className="text-xs text-neutral-500 mt-1">Updated {updatedAt}</p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <a className="underline" href="/leaderboards">Full leaderboards →</a>
            <a className="underline" href="/players">Players directory →</a>
          </div>
        </div>

        <div className="md:col-span-4 grid grid-cols-3 gap-3">
          <Kpi label="NPL Top Total" value={nplTopTotal} />
          <Kpi label="HRL Top Total" value={hrlTopTotal} />
          <Kpi label="Method" value={methodLabel} />
        </div>
      </section>

      {/* NPL Top 10 */}
      <section className="card overflow-hidden">
        <div className="card-header flex items-center justify-between">
          <div>National Poker League — Current Season (Top 10)</div>
          <a
            className="underline text-sm"
            href={lbHref({ scope: "season", type: "npl", mode: "simple", seasonId: "current" })}
          >
            Full table
          </a>
        </div>
        <div className="card-body">
          {!npl?.leaderboard?.length ? (
            <div className="text-sm text-neutral-600">No data.</div>
          ) : (
            <Table
              head={
                <>
                  <th className="text-left w-14">Pos</th>
                  <th className="text-left">Player</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Results</th>
                  <th className="text-right">Avg</th>
                  <th className="text-right">Lowest</th>
                </>
              }
            >
              <SimpleRows rows={npl.leaderboard} />
            </Table>
          )}
        </div>
      </section>

      {/* HRL Top 10 */}
      <section className="card overflow-hidden">
        <div className="card-header flex items-center justify-between">
          <div>High Roller League — Current Season (Top 10)</div>
          <a
            className="underline text-sm"
            href={lbHref({ scope: "season", type: "hrl", mode: "simple", seasonId: "current" })}
          >
            Full table
          </a>
        </div>
        <div className="card-body">
          {!hrl?.leaderboard?.length ? (
            <div className="text-sm text-neutral-600">No data.</div>
          ) : (
            <Table
              head={
                <>
                  <th className="text-left w-14">Pos</th>
                  <th className="text-left">Player</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Results</th>
                  <th className="text-right">Avg</th>
                  <th className="text-right">Lowest</th>
                </>
              }
            >
              <SimpleRows rows={hrl.leaderboard} />
            </Table>
          )}
        </div>
      </section>
    </div>
  );
}
