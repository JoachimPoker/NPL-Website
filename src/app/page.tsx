// src/app/page.tsx
import Link from "next/link";

export const runtime = "nodejs";
export const revalidate = 0;

/* ---------- Types that mirror /api/home ---------- */
type SeasonMeta = {
  id: number;
  label: string;
  start_date: string;
  end_date: string;
  method: "ALL" | "BEST_X";
  cap_x: number;
  is_active: boolean;
};

type LbRow = {
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
  wins?: number;
};

type HomeResp = {
  ok: true;
  season_meta: SeasonMeta;
  leaderboards: { npl: LbRow[]; hrl: LbRow[] };
  upcoming_events: Array<{
    id: string | number;
    name: string | null;
    start_date: string | null;
    festival_id: string | null;
    series_id: number | null;
  }>;
  trending_players: Array<{ player_id: string; hits: number; display_name: string }>;
  biggest_gainers: Array<{ player_id: string; display_name: string; from_pos: number; to_pos: number; delta: number }>;
  latest_results: Array<{
    id: string;                 // result id
    event_id: string | null;
    result_date: string | null; // event.start_date or created_at
    event_name: string | null;
    winner_name: string;
    prize_amount: number | null;
  }>;
};

/* ---------- Small helpers ---------- */
function fmtNum(v: number | null | undefined) {
  if (v === null || v === undefined) return "—";
  return v.toFixed(2);
}
function fmtGBP(v: number | null | undefined) {
  if (v === null || v === undefined) return "—";
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits: 0,
    }).format(v);
  } catch {
    return v.toLocaleString("en-GB", { maximumFractionDigits: 0 });
  }
}

/* ---------- Reusable UI shells (use your card/tbl classes) ---------- */
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}
function CardHeader({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="card-header flex items-center justify-between">
      {children}
      {right}
    </div>
  );
}
function CardBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`card-body ${className}`}>{children}</div>;
}

/* ---------- Page ---------- */
export default async function HomePage() {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const res = await fetch(`${base}/api/home`, { cache: "no-store" });
  if (!res.ok) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <h1 className="text-2xl font-semibold">National Poker League</h1>
          </CardHeader>
          <CardBody>
            <div className="p-2 rounded bg-red-100 text-red-700 text-sm">
              Failed to load homepage data: {res.statusText}
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  const data = (await res.json()) as HomeResp;
  const season = data.season_meta;

  return (
    <div className="space-y-8">
      {/* HERO */}
      <Card>
        <CardHeader>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">National Poker League</h1>
            <p className="text-sm text-neutral-500">
              {season.label} • {season.start_date} → {season.end_date} •{" "}
              {season.method === "BEST_X" ? `Best ${season.cap_x} count` : "All results count"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link className="rounded-md border px-3 py-1.5 text-sm" href="/leaderboards">
              View leaderboards →
            </Link>
            <Link className="rounded-md border px-3 py-1.5 text-sm" href="/events">
              Browse events →
            </Link>
          </div>
        </CardHeader>
      </Card>

      {/* MINI LEADERBOARDS */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* NPL */}
        <Card>
          <CardHeader right={<Link className="rounded-md border px-3 py-1.5 text-sm" href="/leaderboards?npl=1">Full table →</Link>}>
            <b>Leaderboard — NPL</b>
          </CardHeader>
          <CardBody>
            {!data.leaderboards.npl.length ? (
              <div className="text-sm text-neutral-600">No leaderboard yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th className="text-left">Player</th>
                      <th className="text-right">Points</th>
                      <th className="text-right">Used</th>
                      <th className="text-right">Top 3</th>
                      <th className="text-right">Top 9</th>
                      <th className="text-right">Wins</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.leaderboards.npl.slice(0, 10).map((r) => (
                      <tr key={`${r.player_id}-${r.position}`}>
                        <td>{r.position}</td>
                        <td className="truncate" title={r.display_name}>
                          <Link className="underline" href={`/players/${encodeURIComponent(r.player_id)}`}>
                            {r.display_name}
                          </Link>
                        </td>
                        <td className="text-right">{fmtNum(r.total_points)}</td>
                        <td className="text-right">{r.used_count}</td>
                        <td className="text-right">{r.top3_count}</td>
                        <td className="text-right">{r.top9_count}</td>
                        <td className="text-right">{r.wins ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        {/* HR League */}
        <Card>
          <CardHeader right={<Link className="rounded-md border px-3 py-1.5 text-sm" href="/leaderboards?league=hrl">Full table →</Link>}>
            <b>Leaderboard — High Roller League</b>
          </CardHeader>
          <CardBody>
            {!data.leaderboards.hrl.length ? (
              <div className="text-sm text-neutral-600">No leaderboard yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th className="text-left">Player</th>
                      <th className="text-right">Points</th>
                      <th className="text-right">Used</th>
                      <th className="text-right">Top 3</th>
                      <th className="text-right">Top 9</th>
                      <th className="text-right">Wins</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.leaderboards.hrl.slice(0, 10).map((r) => (
                      <tr key={`${r.player_id}-${r.position}`}>
                        <td>{r.position}</td>
                        <td className="truncate" title={r.display_name}>
                          <Link className="underline" href={`/players/${encodeURIComponent(r.player_id)}`}>
                            {r.display_name}
                          </Link>
                        </td>
                        <td className="text-right">{fmtNum(r.total_points)}</td>
                        <td className="text-right">{r.used_count}</td>
                        <td className="text-right">{r.top3_count}</td>
                        <td className="text-right">{r.top9_count}</td>
                        <td className="text-right">{r.wins ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* TRENDING + GAINERS */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Trending players */}
        <Card>
          <CardHeader>
            <b>Trending Players</b>
          </CardHeader>
          <CardBody>
            {!data.trending_players.length ? (
              <div className="text-sm text-neutral-600">No data yet.</div>
            ) : (
              <ul className="divide-y divide-neutral-800">
                {data.trending_players.slice(0, 10).map((p) => (
                  <li key={p.player_id} className="flex items-center justify-between py-2">
                    <Link className="underline" href={`/players/${encodeURIComponent(p.player_id)}`}>
                      {p.display_name}
                    </Link>
                    <span className="text-xs text-neutral-500">{p.hits} searches</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* Biggest gainers */}
        <Card>
          <CardHeader>
            <b>Biggest Gainers</b>
          </CardHeader>
          <CardBody>
            {!data.biggest_gainers.length ? (
              <div className="text-sm text-neutral-600">No recent changes.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th className="text-left">Player</th>
                      <th className="text-right">From</th>
                      <th className="text-right">To</th>
                      <th className="text-right">Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.biggest_gainers.slice(0, 10).map((g) => (
                      <tr key={g.player_id}>
                        <td className="truncate" title={g.display_name}>
                          <Link className="underline" href={`/players/${encodeURIComponent(g.player_id)}`}>
                            {g.display_name}
                          </Link>
                        </td>
                        <td className="text-right">{g.from_pos}</td>
                        <td className="text-right">{g.to_pos}</td>
                        <td className="text-right">{g.delta > 0 ? `+${g.delta}` : g.delta}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* LATEST RESULTS — winners only, new style */}
      <Card className="overflow-hidden">
        <CardHeader right={<Link className="rounded-md border px-3 py-1.5 text-sm" href="/events">All events →</Link>}>
          <b>Latest Results</b>
        </CardHeader>
        <CardBody>
          {!data.latest_results.length ? (
            <div className="text-sm text-neutral-600">No recent results.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="text-left">Date</th>
                    <th className="text-left">Event</th>
                    <th className="text-left">Winner</th>
                    <th className="text-right">Prize</th>
                    <th className="text-left">View</th>
                  </tr>
                </thead>
                <tbody>
                  {data.latest_results.map((r) => (
                    <tr key={r.id}>
                      <td>{r.result_date ?? "—"}</td>
                      <td>{r.event_name ?? "—"}</td>
                      <td>{r.winner_name}</td>
                      <td className="text-right">{fmtGBP(r.prize_amount)}</td>
                      <td>
                        <Link className="underline" href={`/#/result/${encodeURIComponent(r.id)}`}>
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* UPCOMING EVENTS */}
      <Card>
        <CardHeader right={<Link className="rounded-md border px-3 py-1.5 text-sm" href="/events">See calendar →</Link>}>
          <b>Upcoming Events</b>
        </CardHeader>
        <CardBody>
          {!data.upcoming_events.length ? (
            <div className="text-sm text-neutral-600">No upcoming events.</div>
          ) : (
            <ul className="divide-y divide-neutral-800">
              {data.upcoming_events.map((e) => (
                <li key={String(e.id)} className="py-2 flex items-center justify-between">
                  <div className="truncate">
                    <div className="text-sm font-medium truncate">{e.name || "—"}</div>
                    <div className="text-xs text-neutral-500">{e.start_date || "TBA"}</div>
                  </div>
                  <Link className="rounded-md border px-2 py-1 text-sm" href={`/events/${encodeURIComponent(String(e.id))}`}>
                    View
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
