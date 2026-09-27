import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { displayName } from "@/lib/nameMask";
import { type EventSummary, type FestivalSummary, type SeriesRow, gbpShort, day } from "@/lib/tournaments";
import { type BadgeDefinition, baseKey } from "@/lib/badges";
import { FestivalCard, ResultCard } from "@/components/tournaments/TournamentCards";
import BadgeMedal from "@/components/badges/BadgeMedal";
import UpcomingList from "@/components/tournaments/UpcomingList";
import { getUpcoming } from "@/lib/venues";

type Honour = { key: string; def: BadgeDefinition; holders: { id: number; name: string; occasion: string }[]; total: number };

/** Everything the extra home sections need, in parallel. */
export async function getHomeExtras() {
  const supabase = await createSupabaseServerClient();
  const upcomingPromise = getUpcoming({ limit: 3 });
  const { data: season } = await supabase.from("seasons").select("id, name").eq("is_active", true).maybeSingle();
  const sid = season?.id ?? -1;

  const [{ data: events }, { data: festivals }, { data: series }, { data: news }, { data: defs }, { data: stats }, { data: latestAward }] =
    await Promise.all([
      supabase.from("event_summary").select("*").eq("season_id", sid).order("start_date", { ascending: false }),
      supabase.from("festival_summary").select("*").eq("season_id", sid).order("start_date", { ascending: false }).limit(2),
      supabase.from("series").select("id, name, slug, description, logo_url, has_festivals, sort_order"),
      supabase
        .from("news")
        .select("id, title, category, excerpt, published_at")
        .eq("is_published", true)
        .lte("published_at", new Date().toISOString())
        .order("published_at", { ascending: false })
        .limit(3),
      supabase.from("badge_definitions").select("*").eq("is_active", true),
      supabase.from("badge_stats").select("key, holders"),
      supabase.from("player_badges").select("awarded_at").order("awarded_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

  const ev = (events || []) as EventSummary[];
  const seriesById = new Map(((series || []) as SeriesRow[]).map((s) => [s.id, s]));
  // Honours are titles (badges), not achievement milestones.
  const defByKey = new Map(((defs || []) as BadgeDefinition[]).filter((d) => d.kind === "badge").map((d) => [d.key, d]));
  const holdersByKey = new Map((stats || []).map((s: any) => [s.key, Number(s.holders)]));

  // Honours: badges from the latest award run (gold/legendary), unless that run was a bulk
  // back-fill, in which case show the rarest badges instead.
  let honours: Honour[] = [];
  let honoursMode: "recent" | "rarest" = "rarest";
  if (latestAward?.awarded_at) {
    const since = new Date(new Date(latestAward.awarded_at).getTime() - 60 * 60 * 1000).toISOString();
    const { data: recent, count } = await supabase
      .from("player_badges")
      .select("badge_key, badge_name, occasion, player:players(id, forename, surname, display_name, gdpr)", { count: "exact" })
      .gte("awarded_at", since)
      .limit(400);
    if (recent && (count ?? 0) <= 400) {
      honoursMode = "recent";
      honours = group(recent as any[], defByKey, holdersByKey)
        .slice(0, 6);
    }
  }
  if (!honours.length) {
    honoursMode = "rarest";
    const rarest = [...defByKey.values()]
      .filter((d) => (holdersByKey.get(d.key) ?? 0) > 0 && d.condition_type !== "special")
      .sort((a, b) => (holdersByKey.get(a.key) ?? 0) - (holdersByKey.get(b.key) ?? 0))
      .slice(0, 6);
    if (rarest.length) {
      const orFilter = rarest.map((d) => `badge_key.eq.${d.key},badge_key.like.${d.key}@*`).join(",");
      const { data: awards } = await supabase
        .from("player_badges")
        .select("badge_key, badge_name, occasion, player:players(id, forename, surname, display_name, gdpr)")
        .or(orFilter)
        .order("season_year", { ascending: false, nullsFirst: false })
        .limit(60);
      const grouped = group((awards || []) as any[], defByKey, holdersByKey);
      honours = rarest.map((d) => grouped.find((g) => g.key === d.key)).filter((h): h is Honour => !!h);
    }
  }

  return {
    seasonName: season?.name ?? null,
    upcoming: await upcomingPromise,
    seriesNames: new Map([...seriesById.values()].map((s) => [s.id, s.name])),
    stats: {
      events: ev.length,
      cashes: ev.reduce((n, e) => n + e.entries, 0),
      paid: ev.reduce((n, e) => n + Number(e.paid_out || 0), 0),
      festivals: new Set(ev.map((e) => e.festival_id).filter(Boolean)).size,
      updatedTo: ev[0]?.start_date ?? null,
    },
    latest: ev.slice(0, 3).map((e) => ({ event: e, series: e.series_id ? seriesById.get(e.series_id) ?? null : null })),
    festivals: ((festivals || []) as FestivalSummary[])
      .map((f) => ({ festival: f, series: f.series_id ? seriesById.get(f.series_id) : undefined }))
      .filter((x): x is { festival: FestivalSummary; series: SeriesRow } => !!x.series),
    news: news || [],
    honours,
    honoursMode,
  };
}

function group(rows: any[], defByKey: Map<string, BadgeDefinition>, holdersByKey: Map<string, number>): Honour[] {
  const byKey = new Map<string, Honour>();
  for (const r of rows) {
    const key = baseKey(r.badge_key);
    const def = defByKey.get(key);
    if (!def || !r.player) continue;
    const h = byKey.get(key) ?? { key, def, holders: [], total: holdersByKey.get(key) ?? 0 };
    h.holders.push({
      id: r.player.id,
      name: displayName(r.player.forename, r.player.surname, !!r.player.gdpr, r.player.display_name),
      occasion: r.occasion ?? (r.badge_name.startsWith(def.name) ? r.badge_name.slice(def.name.length).replace(/^\s*·?\s*/, "") : ""),
    });
    byKey.set(key, h);
  }
  // Honours are badges (no tiers): rarest first.
  return [...byKey.values()].sort((a, b) => a.total - b.total);
}

type Extras = Awaited<ReturnType<typeof getHomeExtras>>;

/** Published upcoming dates; renders nothing when the schedule is empty. */
export function ComingUp({ extras }: { extras: Extras }) {
  return <UpcomingList items={extras.upcoming} seriesNames={extras.seriesNames} />;
}

/** Thin season-at-a-glance band under the hero. */
export function SeasonStrip({ extras }: { extras: Extras }) {
  const s = extras.stats;
  if (!s.events) return null;
  const items = [
    { label: "Events", value: s.events.toLocaleString("en-GB") },
    { label: "Festivals", value: s.festivals.toLocaleString("en-GB") },
    { label: "Cashes", value: s.cashes.toLocaleString("en-GB") },
    { label: "Paid out", value: gbpShort(s.paid) },
  ];
  return (
    <div className="border-b border-base-content/[0.07] bg-base-300/40">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4 md:gap-x-12">
          {items.map((i) => (
            <div key={i.label}>
              <dt className="eyebrow">{i.label}</dt>
              <dd className="font-display text-xl font-semibold tabular-nums">{i.value}</dd>
            </div>
          ))}
        </dl>
        {s.updatedTo && (
          <p className="text-sm text-base-content/50">
            {extras.seasonName} so far · results up to{" "}
            <span className="text-base-content/80">{day(s.updatedTo, { day: "numeric", month: "long", year: "numeric" })}</span>
          </p>
        )}
      </div>
    </div>
  );
}

function SectionHead({ title, href, linkLabel }: { title: string; href: string; linkLabel: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <h2 className="font-display text-2xl font-semibold tracking-tight">{title}</h2>
      <Link href={href} className="group inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary">
        {linkLabel} <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </Link>
    </div>
  );
}

export function LatestResults({ extras }: { extras: Extras }) {
  if (!extras.latest.length) return null;
  return (
    <section aria-label="Latest results">
      <SectionHead title="Latest results" href="/events" linkLabel="All tournaments" />
      <ul className="grid gap-4 md:grid-cols-3">
        {extras.latest.map(({ event, series }) => (
          <li key={event.id}><ResultCard event={event} series={series} /></li>
        ))}
      </ul>
    </section>
  );
}

export function FestivalsAndNews({ extras }: { extras: Extras }) {
  const hasFestivals = extras.festivals.length > 0;
  const hasNews = extras.news.length > 0;
  if (!hasFestivals && !hasNews) return null;
  return (
    <div className={`grid gap-10 ${hasFestivals && hasNews ? "lg:grid-cols-12" : ""}`}>
      {hasFestivals && (
        <section aria-label="Latest festivals" className={hasNews ? "lg:col-span-7" : ""}>
          <SectionHead title="Festivals" href="/events" linkLabel="All festivals" />
          <ul className="grid gap-4 sm:grid-cols-2">
            {extras.festivals.map(({ festival, series }) => (
              <li key={festival.id}><FestivalCard festival={festival} series={series} /></li>
            ))}
          </ul>
        </section>
      )}
      {hasNews && (
        <section aria-label="News" className={hasFestivals ? "lg:col-span-5" : ""}>
          <SectionHead title="News" href="/news" linkLabel="All news" />
          <ul className="panel divide-y divide-base-content/[0.06]">
            {extras.news.map((n: any) => (
              <li key={n.id}>
                <Link href={`/news/${n.id}`} className="group block p-5 transition-colors hover:bg-base-content/[0.03]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="eyebrow">{n.category ?? "News"}</span>
                    <time className="font-mono text-xs text-base-content/40">{day(n.published_at)}</time>
                  </div>
                  <h3 className="mt-1.5 font-display text-lg font-semibold leading-snug transition-colors group-hover:text-primary">{n.title}</h3>
                  {n.excerpt && <p className="mt-1 line-clamp-2 text-sm text-base-content/55">{n.excerpt}</p>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function Honours({ extras }: { extras: Extras }) {
  if (!extras.honours.length) return null;
  const recent = extras.honoursMode === "recent";
  return (
    <section aria-label={recent ? "Just earned" : "Rarest badges"}>
      <SectionHead title={recent ? "Just earned" : "Rarest badges"} href="/badges" linkLabel="All badges" />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {extras.honours.map((h) => (
          <li key={h.key} className="panel flex items-start gap-4 p-5">
            <BadgeMedal tier="gold" icon={h.def.icon} imageUrl={h.def.image_url} />
            <div className="min-w-0">
              <div className="font-display font-semibold">{h.def.name}</div>
              <div className="text-xs text-base-content/45">
                {recent ? h.def.description : `Held by ${h.total} player${h.total === 1 ? "" : "s"}`}
              </div>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {h.holders.slice(0, 3).map((p, i) => (
                  <li key={`${p.id}-${i}`}>
                    <Link href={`/players/${p.id}`} className="inline-flex rounded-md bg-base-200/70 px-2 py-0.5 text-xs transition-colors hover:text-primary">
                      {p.name}{p.occasion ? ` (${p.occasion})` : ""}
                    </Link>
                  </li>
                ))}
                {h.holders.length > 3 && <li className="px-1 text-xs text-base-content/40">+{h.holders.length - 3}</li>}
              </ul>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-base-content/50">
        Past champions and all-time records live in the{" "}
        <Link href="/hall-of-fame" className="text-primary hover:underline">Hall of Fame</Link>.
      </p>
    </section>
  );
}
