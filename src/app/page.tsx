import SeasonHero from "@/components/home/SeasonHero";
import LeagueLeaders, { type LeagueCard, type LeaderRow } from "@/components/home/LeagueLeaders";
import { getHomeExtras } from "@/components/home/HomeExtras";
import { ThisWeek, ThisSeason, LatestResults, News, type Gainer, type Trending } from "@/components/home/SeasonSections";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { snapshots, type LeagueSlug } from "@/lib/leaderboards";

export const runtime = "nodejs";
export const revalidate = 60;
// Title, description and card text come from the root layout; only the canonical URL is home-specific.
export const metadata = { alternates: { canonical: "/" } };

type HomeResp = {
  ok: boolean;
  season_meta: { id: number; label: string; start_date: string; end_date: string; cap_x: number };
  leagues: { slug: string; label: string; logo_url: string | null }[];
  leaderboards: Record<string, LeaderRow[]>;
  trending_players?: Trending[];
  biggest_gainers?: Gainer[];
};

// Snapshot dates are plain YYYY-MM-DD; read them as UTC so they never shift a day.
const day = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function Unavailable() {
  return (
    <div className="flex flex-1 items-center justify-center bg-season-night px-4 py-32 font-season text-season-ink">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold">The standings didn&apos;t load</h1>
        <p className="mt-2 text-season-muted">We couldn&apos;t reach the latest results. Please try again in a minute.</p>
      </div>
    </div>
  );
}

export default async function HomePage() {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const [res, extras] = await Promise.all([fetch(`${base}/api/home`, { cache: "no-store" }), getHomeExtras()]);
  if (!res.ok) return <Unavailable />;
  const data = (await res.json()) as HomeResp;
  if (!data?.ok || !data.leagues?.length) return <Unavailable />;

  const leagues: LeagueCard[] = data.leagues.map((l) => ({ ...l, rows: (data.leaderboards?.[l.slug] ?? []).slice(0, 5) }));
  const main = leagues.find((l) => l.slug === "npl") ?? leagues[0];
  const [leader, second] = main.rows;

  // Freshness: the latest weekly report's last tournament date for the main league.
  let resultsTo: string | null = null;
  try {
    const db = await createSupabaseServerClient();
    const snap = data.season_meta?.id ? await snapshots(db, data.season_meta.id, main.slug as LeagueSlug) : null;
    resultsTo = snap?.latest ? day(snap.latest) : null;
  } catch {
    resultsTo = null;
  }

  const year = data.season_meta?.label?.match(/\d{4}/)?.[0] ?? String(new Date().getFullYear());
  const leagueShort = main.slug.toUpperCase();
  const line =
    leader && second
      ? `${leader.display_name} leads the ${leagueShort} by ${(Number(leader.total_points) - Number(second.total_points)).toFixed(2)} points.`
      : leader
        ? `${leader.display_name} leads the ${leagueShort} after the first results of the season.`
        : "The new season starts with the first weekly results.";

  return (
    <div className="flex flex-col bg-season-night">
      <SeasonHero headline={`The race for ${year}`} line={line} />
      <LeagueLeaders leagues={leagues} resultsTo={resultsTo} />

      <div className="font-season pb-[clamp(3rem,4.6vw,5rem)]">
        <ThisWeek gainers={data.biggest_gainers ?? []} />
        <ThisSeason extras={extras} />
        <LatestResults extras={extras} />
        <News extras={extras} />
      </div>
    </div>
  );
}
