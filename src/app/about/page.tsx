import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { pageMeta } from "@/lib/site";
import { createSupabasePublicClient } from "@/lib/supabasePublic";
import { formatRules, getLeagues, getSeasons } from "@/lib/leaderboards";
import { type SeriesRow } from "@/lib/tournaments";
import { LEAGUE_MARKS } from "@/components/home/LeagueLeaders";
import { TitleBand } from "@/components/tournaments/ComingUp";
import RuledHeading from "@/components/RuledHeading";
import { getSiteImages } from "@/lib/siteImages";
import { LEAGUE_TERMS, PROMOTER, SCORING, SEASON_END, TERMS_DOCS } from "@/lib/leagueTerms";

export const metadata = pageMeta({
  title: "About the league",
  description: "How the National Poker League works: the three leagues, how a season runs, where it's played and where these results come from.",
  path: "/about",
});
export const revalidate = 3600;

const card = "border border-white/[0.08] bg-[linear-gradient(180deg,#0f3337_0%,#0a2427_100%)]";
const more = "group inline-flex min-h-11 items-center gap-2 text-[0.9375rem] font-medium text-season-ink";

/** What each league is for, in a line. The rules underneath come live from the season's settings. */
const LEAGUE_LINE: Record<string, string> = {
  npl: "The main league: every counted result across every series.",
  hrl: "For High Roller events only.",
  lrl: "For live events with a buy-in of £300 or less.",
};

export default async function AboutPage() {
  const img = await getSiteImages();
  const db = createSupabasePublicClient();
  const seasons = await getSeasons(db);
  const season = seasons.find((s) => s.is_active) ?? seasons[0] ?? null;
  const [leagues, { count: events }, { data: venues }, { data: seriesData }] = await Promise.all([
    getLeagues(db, season?.id ?? null),
    db.from("event_summary").select("id", { count: "exact", head: true }).eq("season_id", season?.id ?? -1),
    db.from("venue_summary").select("casino"),
    db.from("series").select("*").eq("is_active", true).order("sort_order"),
  ]);
  const series = (seriesData || []) as SeriesRow[];
  const firstYear = seasons.length ? Math.min(...seasons.map((s) => s.year)) : null;

  const steps = [
    {
      title: "Play a counted event",
      body: "League events are Grosvenor's live poker events: GUKPT, G300, G200, UK Open, Goliath, 888 UKPL and more. You must play in person.",
    },
    { title: "Cash and score points", body: "A cash earns points based on the buy-in, the field size and where you finish. Your best 20 count, plus 2 points for every cash after that." },
    { title: "Results land every week", body: "The league's weekly points report is added to this site, and every leaderboard, profile and record updates with it." },
    { title: "Climb, collect, finish the season", body: "Leaderboards run all season. Titles and achievements are awarded automatically as results come in." },
  ];

  return (
    <div className="bg-season-night font-season text-season-ink">
      <TitleBand image={img.tournaments_hero} position="object-[70%_45%]">
        <h1 className="text-[clamp(2.5rem,4.4vw,4.375rem)] font-bold leading-[1.02] tracking-[-0.012em]">About the league</h1>
        <p className="mt-3 max-w-[40em] text-[clamp(1.0625rem,1.45vw,1.375rem)] font-medium text-season-muted">
          The National Poker League is a season-long league across Grosvenor&apos;s live poker events in the UK. Cash in a counted event, earn league points, and climb the leaderboards.
        </p>
      </TitleBand>

      <div className="space-y-[clamp(2.75rem,4.5vw,4rem)] px-4 pb-[clamp(2.5rem,4vw,4rem)] pt-[clamp(0.5rem,1.5vw,1.5rem)] sm:px-[3.6vw]">
        {/* The season in numbers, all from the record */}
        {season && (
          <dl className="grid grid-cols-2 gap-px overflow-hidden border border-white/[0.08] bg-white/[0.08] sm:grid-cols-4">
            {[
              { label: "Current season", value: String(season.year) },
              { label: `Events in ${season.year}`, value: (events ?? 0).toLocaleString("en-GB") },
              { label: "Venues", value: (venues?.length ?? 0).toLocaleString("en-GB") },
              { label: "Seasons on record", value: firstYear ? `Since ${firstYear}` : "–" },
            ].map((s) => (
              <div key={s.label} className="flex flex-col-reverse bg-season-night px-5 py-4">
                <dt className="text-[0.9375rem] text-season-muted">{s.label}</dt>
                <dd className="text-[clamp(1.5rem,2.2vw,2rem)] font-bold tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {/* How a season works */}
        <section aria-labelledby="how">
          <RuledHeading id="how">How a season works</RuledHeading>
          <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <li key={s.title} className={`${card} p-5`}>
                <span className="flex size-9 items-center justify-center rounded-full text-[1rem] font-bold tabular-nums text-season-amber shadow-[inset_0_0_0_1px_rgb(242_163_58/0.6)]" aria-hidden="true">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-[1.1875rem] font-semibold leading-snug">{s.title}</h3>
                <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-season-ink/80">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* The three leagues, with this season's rules */}
        {leagues.length > 0 && (
          <section aria-labelledby="leagues">
            <RuledHeading id="leagues">The leagues</RuledHeading>
            <p className="mt-2 text-[0.9375rem] text-season-muted">The same results can count towards more than one league. Rules shown are for the {season?.year} season.</p>
            <ul className="mt-5 grid gap-3 md:grid-cols-3">
              {leagues.map((l) => {
                const mark = LEAGUE_MARKS[l.slug];
                const logo = mark?.src ?? l.logo_url;
                return (
                  <li key={l.slug} className={`${card} flex flex-col p-5`}>
                    {logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logo} alt={l.label} width={mark?.width} height={mark?.height} className="block h-6 w-auto max-w-full object-contain object-left" />
                    ) : (
                      <p className="font-bold">{l.label}</p>
                    )}
                    {LEAGUE_LINE[l.slug] && <p className="mt-4 text-[1.0625rem] font-medium">{LEAGUE_LINE[l.slug]}</p>}
                    <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-season-ink/75">{formatRules(l)}</p>
                    {(() => {
                      const t = LEAGUE_TERMS.find((x) => x.slug === l.slug);
                      if (!t) return null;
                      return (
                        <>
                          {t.dates && <p className="mt-3 text-[0.9375rem] text-season-ink/85">{t.dates}<span className="block text-season-muted">{t.standings}</span></p>}
                          <p className="mt-3 text-[0.875rem] font-medium text-season-ink/85">What counts</p>
                          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[0.875rem] leading-relaxed text-season-ink/75 marker:text-season-muted">
                            {t.counts.map((c) => <li key={c}>{c}</li>)}
                          </ul>
                          {t.notes.map((n) => <p key={n} className="mt-2 text-[0.875rem] text-season-muted">{n}</p>)}
                        </>
                      );
                    })()}
                    <Link href={l.slug === "npl" ? "/leaderboards" : `/leaderboards?league=${l.slug}`} className={`${more} mt-auto pt-3`}>
                      See the leaderboard
                      <ArrowRight size={17} strokeWidth={2.25} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* How points work */}
        <section aria-labelledby="points" className="grid gap-x-[clamp(2rem,4vw,4rem)] gap-y-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <RuledHeading id="points">How points work</RuledHeading>
            <ul className="mt-4 space-y-2.5">
              {SCORING.map((line) => (
                <li key={line} className="flex gap-3 text-[1rem] leading-relaxed text-season-ink/85">
                  <span aria-hidden="true" className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-season-amber" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <RuledHeading id="season-end" as="h2">After the season</RuledHeading>
            <dl className="mt-4 space-y-3">
              {SEASON_END.map((e) => (
                <div key={e.title}>
                  <dt className="text-[1rem] font-semibold">{e.title}</dt>
                  <dd className="mt-0.5 text-[0.9375rem] leading-relaxed text-season-ink/80">{e.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <p className="-mt-[clamp(1rem,2vw,2rem)] text-[0.9375rem] text-season-muted">
          The league is promoted by {PROMOTER}, whose terms and decisions are final. Read the full terms:{" "}
          {TERMS_DOCS.map((d, i) => (
            <span key={d.href}>
              {i > 0 && " · "}
              <a href={d.href} className="font-medium text-season-ink underline decoration-season-ink/30 underline-offset-4 hover:decoration-season-ink">{d.label} (PDF)</a>
            </span>
          ))}
        </p>

        {/* Where it's played */}
        {series.length > 0 && (
          <section aria-labelledby="where">
            <RuledHeading id="where">Where it&apos;s played</RuledHeading>
            <p className="mt-2 max-w-[44em] text-[0.9375rem] text-season-muted">
              Events from these series count towards the league, at {venues?.length ?? 0} venues so far. Each series page has its standings, champions and festivals.
            </p>
            <ul className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {series.map((s) => (
                <li key={s.id}>
                  <Link href={`/events/${s.slug}`} className={`${card} flex h-full items-center justify-center px-4 py-4 transition-colors hover:border-white/25`}>
                    {s.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.logo_url} alt={s.name} className="h-8 w-auto max-w-[9rem] object-contain sm:h-9" />
                    ) : (
                      <span className="text-[1.125rem] font-bold">{s.name}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-x-8">
              <Link href="/events" className={more}>
                Tournaments and dates
                <ArrowRight size={17} strokeWidth={2.25} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link href="/venues" className={more}>
                All venues
                <ArrowRight size={17} strokeWidth={2.25} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </section>
        )}

        {/* Titles and achievements, in brief */}
        <section aria-labelledby="honours" className="grid gap-3 md:grid-cols-2">
          <h2 id="honours" className="sr-only">Titles and achievements</h2>
          <div className={`${card} p-5`}>
            <h3 className="text-[1.1875rem] font-semibold">Titles</h3>
            <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-season-ink/80">
              Won at the table: league championships and podiums, series Main Events and more. Every champion is on the Hall of Fame.
            </p>
            <div className="mt-2 flex flex-wrap gap-x-8">
              <Link href="/hall-of-fame" className={more}>Hall of Fame <ArrowRight size={17} strokeWidth={2.25} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" /></Link>
              <Link href="/badges" className={more}>Every title <ArrowRight size={17} strokeWidth={2.25} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" /></Link>
            </div>
          </div>
          <div className={`${card} p-5`}>
            <h3 className="text-[1.1875rem] font-semibold">Achievements</h3>
            <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-season-ink/80">
              Milestones reached over time, like cashes, wins and final tables, in six levels from Bronze to Legendary.
            </p>
            <Link href="/badges#achievements" className={`${more} mt-2`}>Every achievement <ArrowRight size={17} strokeWidth={2.25} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" /></Link>
          </div>
        </section>

        {/* About this site */}
        <section aria-labelledby="site" className="grid gap-x-[clamp(2rem,4vw,4rem)] gap-y-6 lg:grid-cols-2">
          <div>
            <RuledHeading id="site">About this site</RuledHeading>
            <div className="mt-4 space-y-3 text-[1rem] leading-relaxed text-season-ink/85">
              <p>
                This site is the public record of the National Poker League, built with the league&apos;s endorsement. It isn&apos;t run by {PROMOTER}; the official league table is also in the Poker Live app. Every result comes from the league&apos;s own weekly points report, so the
                leaderboards are only as fresh as the latest report.
              </p>
              <p>
                Players who haven&apos;t agreed to show their name appear as initials and can&apos;t be found by searching. Personal details from the report are never shown.
              </p>
            </div>
          </div>
          <div className={`${card} self-start p-5`}>
            <h3 className="text-[1.1875rem] font-semibold">Play responsibly</h3>
            <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-season-ink/80">
              The league is for players aged 18 and over. Set limits, take breaks, and if gambling stops being fun, free and confidential support is available at{" "}
              <a href="https://www.gambleaware.org" className="font-medium text-season-ink underline decoration-season-ink/40 underline-offset-4 hover:decoration-season-ink">
                GambleAware.org
              </a>
              .
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
