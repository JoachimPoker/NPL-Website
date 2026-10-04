import Link from "next/link";
import { ArrowRight } from "lucide-react";

export type LeaderRow = {
  position: number;
  player_id: string | null;
  display_name: string;
  total_points: number;
  is_anonymized: boolean;
  movement?: number | null;
};

export type LeagueCard = { slug: string; label: string; logo_url: string | null; rows: LeaderRow[] };

/** The owner's vector league marks (solid bars with cut-out lettering); other leagues fall back to their uploaded logo. */
export const LEAGUE_MARKS: Record<string, { src: string; width: number; height: number }> = {
  npl: { src: "/brand/NPL-Logo-White.svg", width: 1600, height: 200 },
  hrl: { src: "/brand/HRL-Long-Colour.svg", width: 1400, height: 200 },
  lrl: { src: "/brand/LRL-Long-Colour.svg", width: 1400, height: 200 },
};

const pts = (n: number) => Number(n).toFixed(2);
const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;

/** A name links to the player unless they are anonymised (GDPR): then it is plain text. */
function Name({ row, className }: { row: LeaderRow; className: string }) {
  if (row.is_anonymized || !row.player_id) return <span className={className}>{row.display_name}</span>;
  return (
    <Link href={`/players/${row.player_id}`} className={`${className} hover:underline hover:decoration-season-ink/40 hover:underline-offset-4`}>
      {row.display_name}
    </Link>
  );
}

/**
 * The lead, drawn: the whole track is the leader's points; the muted part is where 2nd place has reached,
 * the amber part is the gap still between them.
 */
function LeadBar({ leader, second }: { leader: number; second: number | null }) {
  const reach = second != null && leader > 0 ? Math.max(0, Math.min(1, second / leader)) : 0;
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
      <span className="h-full bg-season-ink/25" style={{ width: `${reach * 100}%` }} />
      <span className="h-full flex-1 bg-season-amber" />
    </div>
  );
}

function Card({ league }: { league: LeagueCard }) {
  const [leader, second, third] = league.rows;
  const mark = LEAGUE_MARKS[league.slug];
  const logo = mark?.src ?? league.logo_url;
  const gap = leader && second ? Number(leader.total_points) - Number(second.total_points) : null;

  return (
    // A plain title card, lit softly from above like a table under a lamp. Its five bands sit on the
    // parent grid's rows (subgrid from md up), so the three cards line up whatever the names' lengths.
    <article
      aria-labelledby={`lead-${league.slug}`}
      className="flex flex-col gap-4 border border-white/[0.08] bg-[linear-gradient(180deg,#14434a_0%,#0f3337_55%)] px-5 pb-4 pt-5 sm:px-6 md:row-span-5 md:grid md:grid-rows-[subgrid] md:gap-y-4"
    >
      <h3 id={`lead-${league.slug}`} className="m-0">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={league.label} width={mark?.width} height={mark?.height} className="block h-[1.375rem] w-auto" />
        ) : (
          <span className="text-sm font-bold uppercase tracking-wide text-season-ink">{league.label}</span>
        )}
      </h3>

      {!leader ? (
        <p className="row-span-4 text-[1.0625rem] text-season-muted">The table fills once this season&apos;s first results are in.</p>
      ) : (
        <>
          {/* The container is this block, not the card: a size container cannot also be a subgrid. */}
          <div className="@container md:self-end">
            <Name row={leader} className="block text-[clamp(1.875rem,12cqi,3.25rem)] font-semibold leading-[1.04] tracking-[-0.01em] text-season-ink [overflow-wrap:anywhere]" />
            <p className="mt-2 tabular-nums">
              <span className="text-[clamp(1.875rem,12cqi,3.25rem)] font-bold leading-none text-season-amber">{pts(leader.total_points)}</span>
              <span className="ml-1.5 text-[clamp(1.125rem,5.5cqi,1.5rem)] font-semibold text-season-amber">pts</span>
              <span className="sr-only">, leading the {league.label}</span>
            </p>
          </div>

          <LeadBar leader={Number(leader.total_points)} second={second ? Number(second.total_points) : null} />

          <div className="text-[clamp(0.9375rem,1.05vw,1rem)]">
            {gap != null && (
              <p className="text-season-ink">
                <span className="font-semibold tabular-nums">{pts(gap)}</span> ahead of 2nd
              </p>
            )}
            {(second || third) && (
              <p className="mt-1 text-season-muted">
                {[second, third].filter(Boolean).map((r, i) => (
                  <span key={r!.position}>
                    {i > 0 && <span aria-hidden="true"> · </span>}
                    {ordinal(r!.position)} <Name row={r!} className="text-season-muted" />{" "}
                    <span className="tabular-nums">{pts(r!.total_points)}</span>
                  </span>
                ))}
              </p>
            )}
          </div>

          <Link
            href={league.slug === "npl" ? "/leaderboards" : `/leaderboards?league=${league.slug}`}
            className="group -ml-0.5 inline-flex min-h-11 items-center gap-2 self-start md:self-end md:justify-self-start text-[clamp(0.9375rem,1.05vw,1rem)] font-medium text-season-ink"
          >
            Full leaderboard
            <ArrowRight size={17} strokeWidth={2.25} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </>
      )}
    </article>
  );
}

/** Who leads each league right now: one plain title card per league, its logo as a small badge. */
export default function LeagueLeaders({ leagues, resultsTo }: { leagues: LeagueCard[]; resultsTo: string | null }) {
  return (
    <section aria-labelledby="leading-heading" className="relative bg-season-night px-4 pb-[clamp(3rem,4.6vw,5rem)] font-season text-season-ink sm:px-[3.6vw]">
      <h2 id="leading-heading" className="text-[clamp(1.875rem,2.67vw,2.75rem)] font-semibold leading-[1.1] tracking-[0.01em]">
        Who&apos;s leading
      </h2>
      {resultsTo && <p className="mt-1.5 text-[clamp(1rem,1.15vw,1.125rem)] text-season-muted">Results up to {resultsTo}</p>}
      <div className="mt-5 grid gap-6 md:grid-cols-3 md:grid-rows-[auto_1fr_auto_auto_auto] md:gap-y-0">
        {leagues.map((l) => (
          <Card key={l.slug} league={l} />
        ))}
      </div>
    </section>
  );
}
