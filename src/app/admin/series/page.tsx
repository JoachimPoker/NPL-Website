import Link from "next/link";
import { Badge } from "@/components/tournaments/SeasonCalendar";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { runAutoAssignAction, saveSeriesAction } from "./actions";

export const dynamic = "force-dynamic";

type AssignResult = {
  events_checked: number;
  series_changed: number;
  festival_changed: number;
  festivals_created: number;
  festivals_removed: number;
  events_without_series: number;
};

export default async function AdminSeriesPage(props: { searchParams: Promise<{ assigned?: string }> }) {
  const sp = await props.searchParams;
  let assigned: AssignResult | null = null;
  try { assigned = sp.assigned ? JSON.parse(sp.assigned) : null; } catch {}

  const supabase = await createSupabaseServerClient();
  const [{ data: series }, { data: unassigned, count: unassignedCount }] = await Promise.all([
    supabase
      .from("series")
      .select("id, name, slug, match_pattern, has_festivals, is_active, logo_url, sort_order, events(count), festivals(count)")
      .order("sort_order")
      .order("name"),
    supabase
      .from("events")
      .select("id, tournament_name, casino, start_date", { count: "exact" })
      .is("series_id", null)
      .eq("is_deleted", false)
      .order("start_date", { ascending: false })
      .limit(25),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      <div className="flex flex-col gap-4 border-b border-base-content/[0.07] pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Series &amp; Festivals</h1>
          <p className="max-w-2xl text-sm text-base-content/60">
            Events are put into a series automatically when their name matches the series&apos; pattern, and grouped
            into festivals (same series, same casino, consecutive days). This runs after every import. Changes you
            make on an event&apos;s page are kept.
          </p>
        </div>
        <form action={runAutoAssignAction}>
          <button className="btn btn-outline btn-sm">Re-run detection</button>
        </form>
      </div>

      {assigned && (
        <div role="status" className="alert alert-success text-sm">
          Checked {assigned.events_checked} events: {assigned.series_changed} series and {assigned.festival_changed} festival
          changes, {assigned.festivals_created} festivals created, {assigned.festivals_removed} removed.
          {assigned.events_without_series > 0 && ` ${assigned.events_without_series} events have no series.`}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="panel lg:col-span-2 overflow-hidden">
          <table className="table table-sm w-full">
            <thead className="bg-base-200/50 text-[0.8125rem]">
              <tr>
                <th>Series</th>
                <th className="hidden md:table-cell">Pattern</th>
                <th className="text-right">Events</th>
                <th className="text-right">Festivals</th>
              </tr>
            </thead>
            <tbody>
              {(series || []).map((s: any) => (
                <tr key={s.id} className={`hover:bg-base-200/30 ${s.is_active ? "" : "opacity-50"}`}>
                  <td>
                    <Link href={`/admin/series/${s.id}`} className="flex items-center gap-3 font-semibold hover:text-primary">
                      {/* Fixed-width logo column so the names line up */}
                      <span className="flex w-44 shrink-0 items-center">
                        <Badge series={s} className="h-8" />
                      </span>
                      {s.name}
                    </Link>
                    {!s.is_active && <span className="badge badge-ghost badge-xs ml-10">inactive</span>}
                  </td>
                  <td className="hidden max-w-xs truncate font-mono text-[11px] opacity-60 md:table-cell" title={s.match_pattern ?? ""}>
                    {s.match_pattern || (
                      <span className="">{s.slug === "others" ? "everything no other series claims" : "none: manual only"}</span>
                    )}
                  </td>
                  <td className="text-right font-mono">{s.events?.[0]?.count ?? 0}</td>
                  <td className="text-right font-mono">{s.has_festivals ? s.festivals?.[0]?.count ?? 0 : <span className="whitespace-nowrap opacity-40">single events</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-6">
          {/* New series */}
          <form action={saveSeriesAction} className="panel">
            <div className="card-body space-y-3 p-5">
              <h2 className="font-display text-lg font-semibold">New series</h2>
              <input name="name" required placeholder="Name, e.g. Mini Fest" className="input input-bordered input-sm" aria-label="Series name" />
              <input name="match_pattern" placeholder="Pattern, e.g. ^Mini Fest" className="input input-bordered input-sm font-mono" aria-label="Name pattern" />
              <label className="label cursor-pointer justify-start gap-2 py-0">
                <input type="checkbox" name="has_festivals" defaultChecked className="checkbox checkbox-xs" />
                <span className="label-text text-xs">Runs as festivals (several events at one casino)</span>
              </label>
              <button className="btn btn-primary btn-sm">Create</button>
              <p className="text-[11px] text-base-content/50">
                Patterns are case-insensitive. <code>^</code> means &ldquo;name starts with&rdquo;, <code>|</code> means
                &ldquo;or&rdquo;. You can test a pattern on the series page.
              </p>
            </div>
          </form>

          {/* Events without a series */}
          <div className="panel">
            <div className="card-body p-5">
              <h2 className="font-display text-lg font-semibold">Events without a series ({unassignedCount ?? 0})</h2>
              {unassigned?.length ? (
                <ul className="space-y-2 text-xs">
                  {unassigned.map((e) => (
                    <li key={e.id}>
                      <Link href={`/admin/events/${e.id}`} className="hover:text-primary">{e.tournament_name}</Link>
                      <div className="opacity-50">
                        {e.casino} · {e.start_date ? new Date(e.start_date).toLocaleDateString("en-GB") : "—"}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs opacity-60">Every event belongs to a series.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
