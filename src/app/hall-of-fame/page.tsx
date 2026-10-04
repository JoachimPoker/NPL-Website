import Link from "next/link";
import { pageMeta } from "@/lib/site";
import { Seal } from "@/components/badges/BadgeMedal";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { decodeEntities } from "@/lib/nameMask";
import { gbp } from "@/lib/tournaments";
import { type SealText, sealNumber } from "@/lib/badgeSeal";
import { TitleBand } from "@/components/tournaments/ComingUp";
import { getSiteImages } from "@/lib/siteImages";
import RuledHeading from "@/components/RuledHeading";

export const metadata = pageMeta({ title: "Hall of Fame", description: "Champions and all-time records of the National Poker League.", path: "/hall-of-fame" });
export const revalidate = 3600;

type Podium = {
  season_id: number; season_name: string; year: number; is_active: boolean;
  league_slug: string; league_label: string; position: number;
  player_id: number; display_name: string; total_points: number;
};
type RecordRow = {
  record: string; rank: number; player_id: number; display_name: string;
  value: number; detail: string | null; event_id: number | null;
};

/** A plaque on the wall: a dark panel lit from above, with a fine amber frame. */
const plaque =
  "border border-season-amber/30 bg-[radial-gradient(ellipse_at_50%_0%,rgb(70_150_150/0.22)_0%,transparent_60%),linear-gradient(180deg,rgb(6_25_28/0)_40%,rgb(6_25_28/0.45)_100%)] bg-cover bg-center shadow-[inset_0_0_0_4px_rgb(6_25_28/0.55),inset_0_0_0_5px_rgb(242_163_58/0.14)]";

const singular = (unit: string) => unit.replace(/(sh)es$|s$/, "$1");
const pts = (n: number) => Number(n).toFixed(2);

/** What each league's champion seal says. */
const LEAGUE_SEAL: Record<string, { centre: string; ring: string; short: string }> = {
  npl: { centre: "NPL", ring: "NATIONAL LEAGUE", short: "NPL" },
  hrl: { centre: "HRL", ring: "HIGH ROLLER LEAGUE", short: "High Roller" },
  lrl: { centre: "LRL", ring: "LOW ROLLER LEAGUE", short: "Low Roller" },
};
const championSeal = (slug: string, year: number, leader: boolean): SealText => {
  const l = LEAGUE_SEAL[slug] ?? { centre: slug.toUpperCase(), ring: "LEAGUE", short: slug };
  return { kind: "title", level: 0, top: `SEASON ${year}`, centre: l.centre, sub: leader ? "LEADER" : "CHAMPION", bottom: l.ring };
};

// Play first; the money records close the list. Each record is struck in its own metal (seal level).
const RECORDS: { key: string; title: string; ring: string; metal: number; money?: boolean; unit?: string }[] = [
  { key: "most_wins", title: "Most wins", ring: "MOST WINS", metal: 3, unit: "wins" },
  { key: "most_main_events", title: "Main Event titles", ring: "MAIN EVENT TITLES", metal: 2, unit: "titles" },
  { key: "most_final_tables", title: "Final tables", ring: "FINAL TABLES", metal: 1, unit: "final tables" },
  { key: "most_cashes", title: "Most cashes", ring: "MOST CASHES", metal: 4, unit: "cashes" },
  { key: "most_badges", title: "Most badges", ring: "MOST BADGES", metal: 5, unit: "badges" },
  { key: "most_money", title: "Prize money", ring: "PRIZE MONEY", metal: 6, money: true },
  { key: "biggest_cash", title: "Biggest cash", ring: "BIGGEST CASH", metal: 6, money: true },
];

export default async function HallOfFamePage() {
  const img = await getSiteImages();
  // The plaques' marble (replaceable in admin), under the plaque's light and shade gradients.
  const marble = { backgroundImage: `radial-gradient(ellipse at 50% 0%, rgb(70 150 150 / 0.22) 0%, transparent 60%), linear-gradient(180deg, rgb(6 25 28 / 0) 40%, rgb(6 25 28 / 0.45) 100%), url(${img.plaque_marble})` };
  const supabase = await createSupabaseServerClient();
  const [{ data: podiumData }, { data: recordData }] = await Promise.all([
    supabase.rpc("hall_of_fame_podiums"),
    supabase.rpc("hall_of_fame_records", { p_limit: 5 }),
  ]);
  const podiums = ((podiumData || []) as Podium[]).map((p) => ({ ...p, display_name: decodeEntities(p.display_name) }));
  const records = ((recordData || []) as RecordRow[]).map((r) => ({ ...r, display_name: decodeEntities(r.display_name) }));

  // Seasons (newest first) -> leagues -> top 3
  const seasons = new Map<number, { name: string; year: number; active: boolean; leagues: Map<string, Podium[]> }>();
  for (const p of podiums) {
    const s = seasons.get(p.season_id) ?? { name: p.season_name, year: p.year, active: p.is_active, leagues: new Map() };
    const list = s.leagues.get(p.league_slug) ?? [];
    list.push(p);
    s.leagues.set(p.league_slug, list);
    seasons.set(p.season_id, s);
  }
  const all = [...seasons.values()];
  const current = all.find((s) => s.active) ?? null;
  const finished = all.filter((s) => !s.active);

  // Roll of honour: titles from finished seasons.
  const titles = new Map<number, { id: number; name: string; wins: { league: string; year: number }[] }>();
  for (const p of podiums) {
    if (p.is_active || p.position !== 1) continue;
    const t = titles.get(p.player_id) ?? { id: p.player_id, name: p.display_name, wins: [] };
    t.wins.push({ league: LEAGUE_SEAL[p.league_slug]?.short ?? p.league_label, year: p.year });
    titles.set(p.player_id, t);
  }
  const roll = [...titles.values()].sort((a, b) => b.wins.length - a.wins.length || a.name.localeCompare(b.name));

  const byRecord = new Map<string, RecordRow[]>();
  for (const r of records) byRecord.set(r.record, [...(byRecord.get(r.record) ?? []), r]);
  const since = all.length ? Math.min(...all.map((s) => s.year)) : null;

  return (
    <div className="bg-season-night font-season text-season-ink">
      <TitleBand image={img.hall_of_fame_hero} position="object-[100%_40%]" zoom="origin-[85%_35%] scale-[1.35]">
        <h1 className="text-[clamp(2.5rem,4.4vw,4.375rem)] font-bold leading-[1.02] tracking-[-0.012em]">Hall of Fame</h1>
        <p className="mt-3 max-w-[32em] text-[clamp(1.0625rem,1.45vw,1.375rem)] font-medium text-season-muted">
          {since ? `Every champion since ${since}.` : "Every champion, and the records that still stand."}
        </p>
      </TitleBand>

      <div className="space-y-[clamp(1.75rem,2.4vw,2.5rem)] px-4 pb-[clamp(2.5rem,4vw,4rem)] pt-[clamp(0.5rem,1.5vw,1.5rem)] sm:px-[3.6vw]">
        {/* The wall: the finished seasons' champions on plaques, the years named in the left column */}
        <section aria-labelledby="champions">
          <RuledHeading id="champions">Season champions</RuledHeading>
          {finished.length > 0 && (
            <div className="mt-5 grid gap-x-[clamp(1.5rem,2.5vw,2.5rem)] gap-y-4 lg:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]">
              <div className="flex gap-8 lg:flex-col lg:gap-7 lg:pt-3">
                {finished.map((s) => <YearLabel key={s.year} year={s.year} note="Season champions" />)}
              </div>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {finished.flatMap((s) =>
                  [...s.leagues.entries()].map(([slug, podium]) => {
                    const first = podium[0];
                    return (
                      <li key={`${s.year}-${slug}`} style={marble} className={`${plaque} flex flex-col items-center px-5 pb-6 pt-5 text-center`}>
                        <Seal seal={championSeal(slug, s.year, false)} px={112} label={`${first.league_label} champion ${s.year}`} />
                        <Link
                          href={`/players/${first.player_id}`}
                          className="mt-4 text-[clamp(1.25rem,1.6vw,1.5rem)] font-semibold leading-[1.15] [overflow-wrap:anywhere] decoration-current/40 underline-offset-4 hover:underline"
                        >
                          {first.display_name}
                        </Link>
                        <p className="mt-1.5 text-[1rem] tabular-nums text-season-ink/80">{pts(first.total_points)} pts</p>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          )}

          {/* The season still being played sits apart: no plaque until it's won. */}
          {current && (
            <div className="mt-4 grid gap-x-[clamp(1.5rem,2.5vw,2.5rem)] gap-y-4 border-t border-white/[0.08] pt-4 lg:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] lg:items-center">
              <div>
                <p className="text-[clamp(1.75rem,2.3vw,2.25rem)] font-bold leading-none tabular-nums">{current.year}</p>
                <p className="mt-1.5 text-[0.9375rem] leading-snug text-season-ink/80">In progress:<br className="hidden lg:block" /> current leaders</p>
              </div>
              <ul style={marble} className={`${plaque} grid md:grid-cols-3`}>
                {[...current.leagues.entries()].map(([slug, podium]) => {
                  const first = podium[0];
                  return (
                    <li key={slug} className="flex items-center gap-4 border-b border-white/[0.08] px-5 py-4 last:border-b-0 md:border-b-0 md:[&+&]:border-l">
                      <Seal seal={championSeal(slug, current.year, true)} px={88} />
                      <div className="min-w-0">
                        <p className="text-[0.875rem] text-season-muted">{LEAGUE_SEAL[slug]?.short ?? first.league_label} Leader</p>
                        <Link href={`/players/${first.player_id}`} className="block truncate text-[1.25rem] font-semibold leading-snug decoration-season-ink/40 underline-offset-4 hover:underline">
                          {first.display_name}
                        </Link>
                        <p className="text-[0.9375rem] tabular-nums text-season-ink/75">{pts(first.total_points)} pts</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>

        {/* Roll of honour: the label in the left column, the champions to the right */}
        {roll.length > 0 && (
          <section aria-labelledby="roll" className="grid gap-x-[clamp(1.5rem,2.5vw,2.5rem)] gap-y-3 border-t border-white/[0.08] pt-4 lg:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] lg:items-center">
            <h2 id="roll" className="text-[clamp(1.375rem,1.8vw,1.75rem)] font-semibold leading-tight">Roll of honour</h2>
            <ul className="grid border-b border-white/[0.08] sm:grid-cols-2 lg:grid-cols-3">
              {roll.map((t) => (
                <li key={t.id} className="py-3 sm:px-6 sm:first:pl-0 lg:[&+&]:border-l lg:[&+&]:border-white/[0.1]">
                  <Link href={`/players/${t.id}`} className="text-[1.0625rem] decoration-season-ink/40 underline-offset-4 hover:underline">
                    {t.name}
                  </Link>
                  {t.wins.length > 1 && <span className="ml-2 text-[0.9375rem] font-semibold tabular-nums text-season-amber">×{t.wins.length}</span>}
                  <p className="text-[0.9375rem] tabular-nums text-season-muted">
                    {t.wins.sort((a, b) => b.year - a.year).map((w) => `${w.league} ${w.year}`).join(", ")}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* All-time records: one compact row, each figure struck on its own seal */}
        <section aria-labelledby="records">
          <RuledHeading id="records">All-time records</RuledHeading>
          <ul className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 xl:gap-x-0">
            {RECORDS.map(({ key, title, ring, metal, money, unit }) => {
              const rows = byRecord.get(key) ?? [];
              if (!rows.length) return null;
              const top = rows[0];
              const fmt = (v: number) => (money ? gbp(Number(v)) : `${Number(v).toLocaleString("en-GB")}${unit ? ` ${Number(v) === 1 ? singular(unit) : unit}` : ""}`);
              const seal: SealText = {
                kind: "achievement", level: metal, pips: 0, top: ring, sub: "",
                centre: money ? sealNumber("money", Number(top.value)) : Number(top.value).toLocaleString("en-GB"),
                bottom: "ALL-TIME RECORD",
              };
              return (
                <li key={key} className="flex items-center gap-3 xl:px-3.5 xl:first:pl-0 xl:[&+&]:border-l xl:[&+&]:border-white/[0.1]">
                  <Seal seal={seal} px={56} label={`${title}: ${fmt(top.value)}`} />
                  <div className="min-w-0 text-[0.875rem] leading-snug">
                    <h3 className="text-season-muted">{title}</h3>
                    <Link href={`/players/${top.player_id}`} className="block [overflow-wrap:anywhere] decoration-season-ink/40 underline-offset-4 hover:underline">
                      {top.display_name}
                    </Link>
                    <p className={`tabular-nums ${money ? "text-season-ink/75" : "text-[1rem] font-semibold text-season-amber"}`}>{money ? fmt(top.value) : Number(top.value).toLocaleString("en-GB")}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}

/** A year in the left column: bold, with a short amber rule and a note under it. */
function YearLabel({ year, note }: { year: number; note: string }) {
  return (
    <div>
      <h3 className="text-[clamp(1.75rem,2.3vw,2.25rem)] font-bold leading-none tabular-nums">{year}</h3>
      <span aria-hidden="true" className="mt-2.5 block h-[2px] w-7 bg-season-amber" />
      <p className="mt-2 text-[0.875rem] text-season-muted">{note}</p>
    </div>
  );
}
