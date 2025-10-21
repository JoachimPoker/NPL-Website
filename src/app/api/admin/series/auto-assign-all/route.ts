import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const revalidate = 0;

// ---------- Tunables ----------
const GAP_DAYS = 7;                 // events within this gap belong to same festival run
const MIN_EVENTS_PER_FEST = 3;      // only create a festival if a run has >= this many events
const EXCLUDE_FESTIVAL_SLUGS = new Set(["online", "other"]); // never create festivals for these
const GENERIC_SLUGS = new Set(["online", "other"]);          // penalize when scoring

// ---------- Types ----------
type SeriesRow = {
  slug: string;
  name: string;
  keywords: string[] | null;
  neg_keywords?: string[] | null;
  is_active?: boolean | null;
  active?: boolean | null;
};

type ResultRow = {
  event_id: string;
  start_date: string | null;
  tournament_name: string | null;
  casino: string | null;
  is_deleted: boolean | null;
};

type EventAgg = {
  event_id: string;
  dates: string[];              // all start_date values we saw
  first_date: string;           // min date
  last_date: string;            // max date
  search_text: string;          // concatenated tournament names + casinos
};

type EventAssignment = {
  event_id: string;
  series_slug: string;
  date: string;                 // canonical event date (use min date)
};

// ---------- Helpers ----------
function escRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function kwRegex(kw: string): RegExp {
  const k = kw.trim().toLowerCase();
  if (!k) return /$a/;
  // loose "token" boundaries: not a-z0-9 around the keyword
  return new RegExp(`(?:^|[^a-z0-9])${escRe(k)}(?:$|[^a-z0-9])`, "i");
}
function scoreMatch(text: string, inc: string[], exc: string[], slug: string): number {
  const low = (text || "").toLowerCase();
  if (!inc.length) return -Infinity;

  let hits = 0;
  for (const k of inc) if (kwRegex(k).test(low)) hits++;
  if (hits === 0) return -Infinity;

  // any explicit negative knocks it out
  for (const k of exc) if (k && low.includes(k.toLowerCase())) return -Infinity;

  // base score: number of hits + a small boost for more specific keywords
  const avgLen = inc.filter(Boolean).reduce((a, b) => a + b.length, 0) / Math.max(1, inc.length);
  let score = hits * 10 + Math.min(10, Math.floor(avgLen / 3));

  // penalize generic
  if (GENERIC_SLUGS.has(slug)) score -= 50;

  return score;
}

function chunk<T>(arr: T[], size = 1000): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ---------- Route ----------
export async function POST() {
  try {
    const s = supabaseAdmin();

    // 1) Load active series
    const { data: seriesRows, error: sErr } = await s
      .from("series")
      .select("slug, name, keywords, neg_keywords, is_active, active");
    if (sErr) throw sErr;

    const series: SeriesRow[] = (seriesRows ?? [])
      .map((r: any) => ({
        slug: r.slug,
        name: r.name,
        keywords: Array.isArray(r.keywords) ? r.keywords : [],
        neg_keywords: Array.isArray(r.neg_keywords) ? r.neg_keywords : [],
        is_active: r.is_active ?? r.active ?? true,
        active: r.active,
      }))
      .filter((r) => r.is_active !== false);
    const seriesBySlug = new Map(series.map((r) => [r.slug, r]));

    // 2) Aggregate RESULTS per event_id (names live in results, not events)
    //    Build search_text and the min/max date per event.
    const agg = new Map<string, EventAgg>();
    {
      const PAGE = 5000;
      let from = 0;
      for (;;) {
        const { data, error } = await s
          .from("results")
          .select("event_id, start_date, tournament_name, casino, is_deleted")
          .eq("is_deleted", false)
          .order("event_id", { ascending: true })
          .range(from, from + PAGE - 1);

        if (error) throw error;
        const batch: ResultRow[] = (data ?? []) as any[];
        if (!batch.length) break;

        for (const r of batch) {
          if (!r.event_id) continue;
          const id = r.event_id;
          const d = (r.start_date || "").trim();
          const nm = (r.tournament_name || "").trim();
          const cs = (r.casino || "").trim();

          let node = agg.get(id);
          if (!node) {
            node = {
              event_id: id,
              dates: [],
              first_date: d || "",
              last_date: d || "",
              search_text: "",
            };
            agg.set(id, node);
          }

          if (d) {
            node.dates.push(d);
            if (!node.first_date || d < node.first_date) node.first_date = d;
            if (!node.last_date || d > node.last_date) node.last_date = d;
          }
          if (nm) node.search_text += (node.search_text ? " " : "") + nm.toLowerCase();
          if (cs) node.search_text += (node.search_text ? " " : "") + cs.toLowerCase();
        }

        if (batch.length < PAGE) break;
        from += PAGE;
      }
    }

    // 3) Score each event against all series, choose best if any hit
    const assignments: EventAssignment[] = [];
    for (const ev of agg.values()) {
      const incText = ev.search_text;
      let bestSlug: string | null = null;
      let bestScore = -Infinity;

      for (const sr of series) {
        const inc = (sr.keywords || []).map(String).filter(Boolean);
        const exc = (sr.neg_keywords || []).map(String).filter(Boolean);
        const sc = scoreMatch(incText, inc, exc, sr.slug);
        if (sc > bestScore) {
          bestScore = sc;
          bestSlug = sr.slug;
        }
      }
      if (bestScore === -Infinity || !bestSlug) {
        // no keyword hits => no series assignment for this event
        continue;
      }

      assignments.push({
        event_id: ev.event_id,
        series_slug: bestSlug,
        date: ev.first_date || ev.last_date || "", // canonical date for run grouping
      });
    }

    // 4) Upsert event_series (series only; festival_id left NULL)
    let upsertedSeries = 0;
    for (const batch of chunk(assignments, 1000)) {
      const payload = batch.map((b) => ({
        event_id: b.event_id,
        series_slug: b.series_slug,
        festival_id: null as string | null,
      }));
      const { error } = await s
        .from("event_series")
        .upsert(payload, { onConflict: "event_id" });
      if (error) throw error;
      upsertedSeries += batch.length;
    }

    // 5) Build runs per series (gap <= GAP_DAYS), then create festivals
    //    Only for series NOT in EXCLUDE_FESTIVAL_SLUGS and runs with >= MIN_EVENTS_PER_FEST.
    //    Do it in-memory to avoid complex window SQL in the app tier.
    type Run = { series_slug: string; start_date: string; end_date: string; count: number };
    const runs: Run[] = [];
    const bySeries = new Map<string, EventAssignment[]>();
    for (const row of assignments) {
      const arr = bySeries.get(row.series_slug) || [];
      arr.push(row);
      bySeries.set(row.series_slug, arr);
    }

    for (const [slug, arr] of bySeries.entries()) {
      // sort by date asc
      arr.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      let curStart = "";
      let curEnd = "";
      let curCount = 0;

      function pushRun() {
        if (!curStart || !curEnd || curCount <= 0) return;
        runs.push({ series_slug: slug, start_date: curStart, end_date: curEnd, count: curCount });
      }

      for (let i = 0; i < arr.length; i++) {
        const d = arr[i].date;
        if (!d) continue;
        if (curStart === "") {
          curStart = d;
          curEnd = d;
          curCount = 1;
          continue;
        }
        // day gap between curEnd and d
        const gap = daysBetween(curEnd, d);
        if (gap <= GAP_DAYS) {
          curEnd = d;
          curCount += 1;
        } else {
          // finish previous run
          pushRun();
          // start new
          curStart = d;
          curEnd = d;
          curCount = 1;
        }
      }
      // push last run
      pushRun();
    }

    // filter to eligible runs
    const eligible = runs.filter(
      (r) =>
        !EXCLUDE_FESTIVAL_SLUGS.has(r.series_slug) &&
        r.count >= MIN_EVENTS_PER_FEST
    );

    // upsert festivals
    type FestivalInsert = {
      series_slug: string;
      label: string;
      city: string | null;
      start_date: string;
      end_date: string;
    };
    const festivalsToInsert: FestivalInsert[] = eligible.map((r) => {
      const sRow = seriesBySlug.get(r.series_slug);
      const seriesName = sRow?.name || r.series_slug.toUpperCase();
      return {
        series_slug: r.series_slug,
        label: `${seriesName} (${r.start_date} → ${r.end_date})`,
        city: null,
        start_date: r.start_date,
        end_date: r.end_date,
      };
    });

    let createdFestivals = 0;
    for (const batch of chunk(festivalsToInsert, 500)) {
      const { error } = await s
        .from("festivals")
        .upsert(batch, { onConflict: "series_slug,start_date,end_date" });
      if (error) throw error;
      createdFestivals += batch.length;
    }

    // fetch the just-created/ensured festivals to get their IDs for attachment
    const { data: fList, error: fErr } = await s
      .from("festivals")
      .select("id, series_slug, start_date, end_date");
    if (fErr) throw fErr;

    // map series_slug + date window => festival_id
    type FestKey = string;
    const fKey = (slug: string, start: string, end: string): FestKey => `${slug}__${start}__${end}`;

    const festIdByWindow = new Map<FestKey, string>();
    for (const f of fList ?? []) {
      festIdByWindow.set(fKey(f.series_slug, f.start_date, f.end_date), f.id);
    }

    // Attach events to the festival window they belong to (if any).
    // For speed, build a quick index of windows per series.
    const windowsBySeries = new Map<string, { start: string; end: string; id: string }[]>();
    for (const f of fList ?? []) {
      if (!windowsBySeries.has(f.series_slug)) windowsBySeries.set(f.series_slug, []);
      windowsBySeries.get(f.series_slug)!.push({ start: f.start_date, end: f.end_date, id: f.id });
    }
    for (const arr of windowsBySeries.values()) {
      arr.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
    }

    // build updates
    const updates: { event_id: string; series_slug: string; festival_id: string | null }[] = [];
    for (const a of assignments) {
      const wins = windowsBySeries.get(a.series_slug) || [];
      const f = wins.find((w) => a.date >= w.start && a.date <= w.end);
      updates.push({
        event_id: a.event_id,
        series_slug: a.series_slug,
        festival_id: f ? f.id : null,
      });
    }

    let attached = 0;
    for (const batch of chunk(updates, 1000)) {
      const { error } = await s
        .from("event_series")
        .upsert(batch, { onConflict: "event_id" });
      if (error) throw error;
      attached += batch.length;
    }

    return NextResponse.json({
      ok: true,
      stats: {
        events_scored: assignments.length,
        series_upserted: upsertedSeries,
        festivals_created_or_ensured: createdFestivals,
        events_attached_to_festival_windows: attached,
        gap_days: GAP_DAYS,
        min_events_per_festival: MIN_EVENTS_PER_FEST,
        no_festivals_for_slugs: Array.from(EXCLUDE_FESTIVAL_SLUGS),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, _error: String(e?.message || e) }, { status: 500 });
  }
}

// parse YYYY-MM-DD (no timezone math)
function daysBetween(d1: string, d2: string): number {
  // simple lexical ordering is fine because we compare YYYY-MM-DD strings,
  // but we need difference in days for gap check
  const a = new Date(d1 + "T00:00:00Z");
  const b = new Date(d2 + "T00:00:00Z");
  return Math.round((Number(b) - Number(a)) / 86400000);
}
