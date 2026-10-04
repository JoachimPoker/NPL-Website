import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

const range = (a: string, b: string) => {
  const f = (d: string, y = false) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(y ? { year: "numeric" } : {}) });
  return a === b ? f(a, true) : `${f(a)} – ${f(b, true)}`;
};

export default async function AdminFestivalsPage(props: { searchParams: Promise<{ season?: string; series?: string; deleted?: string }> }) {
  const sp = await props.searchParams;
  const db = await createSupabaseServerClient();

  const [{ data: seasons }, { data: series }] = await Promise.all([
    db.from("seasons").select("id, year, is_active").order("year", { ascending: false }),
    db.from("series").select("id, name").eq("is_active", true).order("sort_order"),
  ]);
  const season = (seasons || []).find((s) => String(s.year) === sp.season) ?? (seasons || []).find((s) => s.is_active) ?? seasons?.[0];
  const seriesId = sp.series ? Number(sp.series) : null;

  let q = db
    .from("festivals")
    .select("id, label, start_date, end_date, casino, is_auto, series_id, events!events_festival_id_fkey(count)")
    .order("start_date", { ascending: false });
  if (season) q = q.eq("season_id", season.id);
  if (seriesId) q = q.eq("series_id", seriesId);
  const { data: festivals } = await q;
  const seriesName = new Map((series || []).map((s) => [s.id, s.name]));

  const href = (patch: { season?: string | null; series?: string | null }) => {
    const p = new URLSearchParams();
    const s = patch.season !== undefined ? patch.season : season && !season.is_active ? String(season.year) : null;
    const r = patch.series !== undefined ? patch.series : seriesId ? String(seriesId) : null;
    if (s) p.set("season", s);
    if (r) p.set("series", r);
    return `/admin/festivals${p.toString() ? `?${p}` : ""}`;
  };
  const chip = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors ${
      active ? "bg-primary text-primary-content ring-primary" : "text-base-content/70 ring-base-content/15 hover:text-base-content"
    }`;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 border-b border-base-content/[0.07] pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Festivals</h1>
          <p className="max-w-2xl text-sm text-base-content/60">
            A festival is a series at one venue over a run of dates. They&apos;re detected automatically after each import;
            create one by hand, or open one to change its dates and events. Festivals set by hand are never changed by detection.
          </p>
        </div>
        <Link href="/admin/festivals/new" className="btn btn-primary btn-sm">+ New festival</Link>
      </div>

      {sp.deleted && <div role="status" className="alert alert-success text-sm">Festival deleted.</div>}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow mr-1 w-14">Season</span>
          {(seasons || []).map((s) => (
            <Link key={s.id} href={href({ season: s.is_active ? null : String(s.year) })} className={chip(season?.id === s.id)}>{s.year}</Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow mr-1 w-14">Series</span>
          <Link href={href({ series: null })} className={chip(!seriesId)}>All</Link>
          {(series || []).map((s) => (
            <Link key={s.id} href={href({ series: String(s.id) })} className={chip(seriesId === s.id)}>{s.name}</Link>
          ))}
        </div>
      </div>

      <div className="panel overflow-hidden">
        <table className="table w-full">
          <thead>
            <tr>
              <th className="pl-6">Festival</th>
              <th className="hidden md:table-cell">Series</th>
              <th className="hidden sm:table-cell">Venue</th>
              <th>Dates</th>
              <th className="text-right">Events</th>
              <th className="pr-6 text-right">Set by</th>
            </tr>
          </thead>
          <tbody>
            {(festivals || []).map((f: any) => (
              <tr key={f.id} className="hover:bg-base-content/[0.03]">
                <td className="pl-6">
                  <Link href={`/admin/festivals/${f.id}`} className="font-medium hover:text-primary">{f.label}</Link>
                </td>
                <td className="hidden text-sm text-base-content/70 md:table-cell">{f.series_id ? seriesName.get(f.series_id) ?? "—" : "—"}</td>
                <td className="hidden text-sm text-base-content/70 sm:table-cell">{f.casino ?? "—"}</td>
                <td className="whitespace-nowrap font-mono text-xs text-base-content/60">{range(f.start_date, f.end_date)}</td>
                <td className="text-right font-mono text-sm">{f.events?.[0]?.count ?? 0}</td>
                <td className="pr-6 text-right">
                  {f.is_auto ? (
                    <span className="text-xs text-base-content/45">detection</span>
                  ) : (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">hand</span>
                  )}
                </td>
              </tr>
            ))}
            {!festivals?.length && (
              <tr><td colSpan={6} className="py-12 text-center text-sm text-base-content/50">No festivals for this selection.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
