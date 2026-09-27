import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import EventsTable, { type AdminEventRow } from "./EventsTable";

export const dynamic = "force-dynamic";

type SP = {
  q?: string; season?: string; series?: string; venue?: string; fest?: string; festival?: string;
  hr?: string; hand?: string; status?: string; sort?: string; dir?: string; page?: string; size?: string;
};

const SORTS: Record<string, { label: string; column: string }> = {
  date: { label: "Date", column: "start_date" },
  name: { label: "Event", column: "name" },
  venue: { label: "Venue", column: "casino" },
  buyin: { label: "Buy-in", column: "buy_in" },
  cashes: { label: "Cashes", column: "entries" },
  paid: { label: "Paid out", column: "paid_out" },
};

export default async function AdminEventsPage(props: { searchParams: Promise<SP> }) {
  const sp = await props.searchParams;
  const db = await createSupabaseServerClient();

  const [{ data: seasons }, { data: series }, { data: venues }] = await Promise.all([
    db.from("seasons").select("id, year, is_active").order("year", { ascending: false }),
    db.from("series").select("id, name, has_festivals").order("sort_order"),
    db.from("venue_summary").select("casino").order("casino"),
  ]);
  const season = sp.season === "all" ? null : (seasons || []).find((s) => String(s.year) === sp.season) ?? (seasons || []).find((s) => s.is_active) ?? null;
  const seriesById = new Map((series || []).map((s) => [s.id, s]));
  const festivalSeriesIds = (series || []).filter((s) => s.has_festivals).map((s) => s.id);
  const removed = sp.status === "removed";
  const sortKey = SORTS[sp.sort ?? ""] ? sp.sort! : "date";
  const ascending = sp.dir === "asc";
  const size = [50, 100, 200].includes(Number(sp.size)) ? Number(sp.size) : 50;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q?.trim() || null;

  // Events pinned by hand (any field), for the "set by hand" filter.
  let handIds: number[] | null = null;
  if (sp.hand === "1") {
    const { data } = await db
      .from("events")
      .select("id")
      .or("series_locked.eq.true,festival_locked.eq.true,details_locked.eq.true,is_high_roller_locked.eq.true")
      .limit(5000);
    handIds = (data || []).map((e) => e.id);
  }

  // Live events come from event_summary (with cashes and paid out); removed ones from events.
  const table = removed ? "events" : "event_summary";
  const cols = removed
    ? "id, season_id, series_id, festival_id, name:tournament_name, casino, start_date, buy_in, is_high_roller"
    : "id, season_id, series_id, festival_id, name, casino, start_date, buy_in, is_high_roller, entries, paid_out, winner_name";

  // Filters shared by the table and the summary counts. `skipFest` leaves out the festival filter.
  const filtered = (query: any, skipFest = false) => {
    if (removed) query = query.eq("is_deleted", true);
    if (season) query = query.eq("season_id", season.id);
    if (q) query = query.ilike(removed ? "tournament_name" : "name", `%${q}%`);
    if (sp.series === "none") query = query.is("series_id", null);
    else if (sp.series) query = query.eq("series_id", Number(sp.series));
    if (sp.venue) query = query.eq("casino", sp.venue);
    if (sp.hr === "1") query = query.eq("is_high_roller", true);
    if (sp.hr === "0") query = query.eq("is_high_roller", false);
    if (handIds) query = query.in("id", handIds.length ? handIds : [-1]);
    if (!skipFest) {
      if (sp.festival) query = query.eq("festival_id", sp.festival);
      else if (sp.fest === "in") query = query.not("festival_id", "is", null);
      else if (sp.fest === "out") query = query.is("festival_id", null);
      else if (sp.fest === "floating") query = query.is("festival_id", null).in("series_id", festivalSeriesIds.length ? festivalSeriesIds : [-1]);
    }
    return query;
  };

  // The same builder works on events or event_summary, so it's typed loosely.
  const anyDb = db as any;
  const sortCol = removed && sortKey === "name" ? "tournament_name" : SORTS[sortKey].column;
  const from = (page - 1) * size;
  const [{ data: rows, count, error }, { count: inCount }, { count: outCount }, { data: festivals }] = await Promise.all([
    filtered(anyDb.from(table).select(cols, { count: "exact" }))
      .order(removed && ["entries", "paid_out"].includes(sortCol) ? "start_date" : sortCol, { ascending, nullsFirst: false })
      .order("id", { ascending: false })
      .range(from, from + size - 1),
    filtered(anyDb.from(table).select("id", { count: "exact", head: true }), true).not("festival_id", "is", null),
    filtered(anyDb.from(table).select("id", { count: "exact", head: true }), true).is("festival_id", null),
    db
      .from("festivals")
      .select("id, label, season_id")
      .order("start_date", { ascending: false })
      .limit(400),
  ]);
  const festivalLabel = new Map((festivals || []).map((f) => [f.id, f.label]));
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / size));

  const events: AdminEventRow[] = ((rows || []) as any[]).map((e) => ({
    id: e.id,
    name: e.name ?? "Unnamed event",
    start_date: e.start_date,
    casino: e.casino,
    buy_in: e.buy_in,
    is_high_roller: !!e.is_high_roller,
    series: e.series_id ? seriesById.get(e.series_id)?.name ?? "—" : null,
    series_has_festivals: e.series_id ? !!seriesById.get(e.series_id)?.has_festivals : false,
    festival_id: e.festival_id,
    festival: e.festival_id ? festivalLabel.get(e.festival_id) ?? "Festival" : null,
    entries: e.entries ?? null,
    paid_out: e.paid_out ?? null,
    winner: e.winner_name ?? null,
  }));

  // Links keep every other filter.
  const href = (patch: Partial<SP>) => {
    const next: Record<string, string | undefined> = { ...sp, page: undefined, ...patch };
    const p = new URLSearchParams(Object.entries(next).filter(([, v]) => v != null && v !== "") as [string, string][]);
    return `/admin/events${p.toString() ? `?${p}` : ""}`;
  };
  const chip = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors ${
      active ? "bg-primary text-primary-content ring-primary" : "text-base-content/70 ring-base-content/15 hover:text-base-content"
    }`;
  const sortHref = (key: string) =>
    href({ sort: key === "date" ? undefined : key, dir: sortKey === key ? (ascending ? undefined : "asc") : key === "date" || key === "buyin" || key === "cashes" || key === "paid" ? undefined : "asc" });
  const SortTh = ({ k, className = "" }: { k: string; className?: string }) => (
    <Link href={sortHref(k)} className={`inline-flex items-center gap-1 hover:text-base-content ${sortKey === k ? "text-primary" : ""} ${className}`}>
      {SORTS[k].label}
      {sortKey === k && (ascending ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
    </Link>
  );
  const anyFilter = !!(q || sp.series || sp.venue || sp.fest || sp.festival || sp.hr || sp.hand || removed || sp.season);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <div className="border-b border-base-content/[0.07] pb-6">
        <div className="eyebrow mb-2 text-primary">Admin</div>
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Events</h1>
        <p className="max-w-2xl text-sm text-base-content/60">
          Filter, sort and fix events. Tick several to change their High Roller status, series or festival together;
          anything set here is kept by later imports.
        </p>
      </div>

      {/* Filters */}
      <div className="panel space-y-3 p-5">
        <form action="/admin/events" className="flex flex-wrap items-end gap-3">
          {Object.entries(sp)
            .filter(([k, v]) => v && !["q", "series", "venue", "page", "size"].includes(k))
            .map(([k, v]) => <input key={k} type="hidden" name={k} value={v as string} />)}
          <label className="form-control w-full sm:w-64">
            <span className="label-text mb-1 text-xs font-bold">Search</span>
            <input name="q" defaultValue={q ?? ""} placeholder="Event name" className="input input-bordered input-sm" />
          </label>
          <label className="form-control w-full sm:w-48">
            <span className="label-text mb-1 text-xs font-bold">Series</span>
            <select name="series" defaultValue={sp.series ?? ""} className="select select-bordered select-sm">
              <option value="">All series</option>
              <option value="none">No series</option>
              {(series || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="form-control w-full sm:w-48">
            <span className="label-text mb-1 text-xs font-bold">Venue</span>
            <select name="venue" defaultValue={sp.venue ?? ""} className="select select-bordered select-sm">
              <option value="">All venues</option>
              {(venues || []).map((v) => <option key={v.casino} value={v.casino}>{v.casino}</option>)}
            </select>
          </label>
          <label className="form-control w-full sm:w-28">
            <span className="label-text mb-1 text-xs font-bold">Per page</span>
            <select name="size" defaultValue={String(size)} className="select select-bordered select-sm">
              {[50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <button className="btn btn-primary btn-sm">Apply</button>
          {anyFilter && <Link href="/admin/events" className="btn btn-ghost btn-sm">Reset all</Link>}
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow mr-1 w-16">Season</span>
          {(seasons || []).map((s) => (
            <Link key={s.id} href={href({ season: s.is_active ? undefined : String(s.year) })} className={chip(season?.id === s.id)}>{s.year}</Link>
          ))}
          <Link href={href({ season: "all" })} className={chip(!season)}>All</Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow mr-1 w-16">Festival</span>
          <Link href={href({ fest: undefined, festival: undefined })} className={chip(!sp.fest && !sp.festival)}>All</Link>
          <Link href={href({ fest: "in", festival: undefined })} className={chip(sp.fest === "in")}>In a festival</Link>
          <Link href={href({ fest: "out", festival: undefined })} className={chip(sp.fest === "out")}>Not in a festival</Link>
          <Link href={href({ fest: "floating", festival: undefined })} className={chip(sp.fest === "floating")} title="Events of a festival series (GUKPT, UKPL…) that aren't in any festival">
            Floating (festival series)
          </Link>
          {sp.festival && <span className={chip(true)}>{festivalLabel.get(sp.festival) ?? "One festival"}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow mr-1 w-16">Type</span>
          <Link href={href({ hr: undefined })} className={chip(!sp.hr)}>All</Link>
          <Link href={href({ hr: "1" })} className={chip(sp.hr === "1")}>High Roller</Link>
          <Link href={href({ hr: "0" })} className={chip(sp.hr === "0")}>Not High Roller</Link>
          <span className="mx-2 h-4 w-px bg-base-content/10" />
          <Link href={href({ hand: sp.hand === "1" ? undefined : "1" })} className={chip(sp.hand === "1")}>Set by hand</Link>
          <Link href={href({ status: removed ? undefined : "removed" })} className={chip(removed)} title="Events no longer in the latest report">
            Removed from report
          </Link>
        </div>
      </div>

      {/* Summary */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-semibold">{total.toLocaleString("en-GB")} events</span>
        <Link href={href({ fest: "in", festival: undefined })} className="rounded-full bg-success/15 px-3 py-1 text-xs font-medium text-success hover:underline">
          {(inCount ?? 0).toLocaleString("en-GB")} in a festival
        </Link>
        <Link href={href({ fest: "out", festival: undefined })} className="rounded-full bg-warning/15 px-3 py-1 text-xs font-medium text-warning hover:underline">
          {(outCount ?? 0).toLocaleString("en-GB")} not in a festival
        </Link>
      </div>

      {error ? (
        <div className="alert alert-error text-sm">Couldn&apos;t load events: {error.message}</div>
      ) : (
        <EventsTable
          events={events}
          removed={removed}
          series={(series || []).map((s) => ({ id: s.id, name: s.name }))}
          festivals={((festivals || []) as any[])
            .filter((f) => !season || f.season_id === season.id)
            .map((f) => ({ id: f.id, label: f.label }))}
          headers={{
            date: <SortTh k="date" />,
            name: <SortTh k="name" />,
            venue: <SortTh k="venue" />,
            buyin: <SortTh k="buyin" className="justify-end" />,
            cashes: <SortTh k="cashes" className="justify-end" />,
            paid: <SortTh k="paid" className="justify-end" />,
          }}
        />
      )}

      {/* Paging */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="text-base-content/55">
          {total ? `${(from + 1).toLocaleString("en-GB")}–${Math.min(from + size, total).toLocaleString("en-GB")} of ${total.toLocaleString("en-GB")}` : "No events"}
        </span>
        <div className="join">
          <Link href={href({ page: page > 2 ? String(page - 1) : undefined })} className={`join-item btn btn-sm btn-ghost ${page <= 1 ? "btn-disabled" : ""}`}>« Prev</Link>
          <span className="join-item btn btn-sm btn-ghost pointer-events-none">Page {page} of {pages}</span>
          <Link href={href({ page: String(page + 1) })} className={`join-item btn btn-sm btn-ghost ${page >= pages ? "btn-disabled" : ""}`}>Next »</Link>
        </div>
      </div>
    </div>
  );
}
