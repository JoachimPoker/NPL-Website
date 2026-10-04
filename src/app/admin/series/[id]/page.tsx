import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import ImageField from "@/components/admin/ImageField";
import { saveSeriesAction, deleteSeriesAction } from "../actions";
import PatternField from "./PatternField";

export const dynamic = "force-dynamic";

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

export default async function AdminSeriesDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const seriesId = Number(id);
  if (!Number.isFinite(seriesId)) notFound();

  const supabase = await createSupabaseServerClient();
  const [{ data: s }, { data: festivals }, { data: singles, count: eventCount }] = await Promise.all([
    supabase.from("series").select("*").eq("id", seriesId).maybeSingle(),
    supabase
      .from("festivals")
      .select("id, label, casino, start_date, end_date, season:seasons(name), events!events_festival_id_fkey(count)")
      .eq("series_id", seriesId)
      .order("start_date", { ascending: false }),
    supabase
      .from("events")
      .select("id, tournament_name, casino, start_date, festival_id", { count: "exact" })
      .eq("series_id", seriesId)
      .eq("is_deleted", false)
      .order("start_date", { ascending: false })
      .limit(40),
  ]);
  if (!s) notFound();

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      <div className="flex flex-col gap-4 border-b border-base-content/[0.07] pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <Link href="/admin/series" className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-[0.9375rem] font-medium text-season-ink/75 hover:text-season-ink"><span aria-hidden="true">←</span> Series</Link>
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{s.name}</h1>
          <p className="text-sm text-base-content/60">
            {eventCount ?? 0} events{s.has_festivals ? ` · ${festivals?.length ?? 0} festivals` : " · single events"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/events/${s.id}`} className="btn btn-ghost btn-sm">Public page</Link>
          <Link href="/admin/series" className="btn btn-ghost btn-sm">← All series</Link>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        {/* Settings */}
        <form action={saveSeriesAction} className="panel h-fit lg:col-span-2">
          <div className="card-body space-y-4 p-6">
            <input type="hidden" name="id" value={s.id} />
            <div className="grid grid-cols-3 gap-3">
              <label className="form-control col-span-2">
                <span className="label-text mb-1 text-xs font-bold">Name</span>
                <input name="name" required defaultValue={s.name} className="input input-bordered input-sm" />
              </label>
              <label className="form-control">
                <span className="label-text mb-1 text-xs font-bold">Order</span>
                <input name="sort_order" type="number" defaultValue={s.sort_order} className="input input-bordered input-sm" title="Lower numbers are checked first when several patterns match" />
              </label>
            </div>
            <label className="form-control">
              <span className="label-text mb-1 text-xs font-bold">Web address (slug)</span>
              <input name="slug" defaultValue={s.slug} className="input input-bordered input-sm font-mono" />
            </label>
            <label className="form-control">
              <span className="label-text mb-1 text-xs font-bold">Description</span>
              <textarea name="description" rows={3} defaultValue={s.description ?? ""} className="textarea textarea-bordered text-sm" />
            </label>

            <PatternField defaultValue={s.match_pattern ?? ""} />

            <ImageField name="logo_url" folder="logos" label="Logo" defaultValue={s.logo_url ?? ""} />
            {s && "image_url" in s && (
              <ImageField
                name="image_url"
                folder="photos"
                label="Series photo (optional): series page, its festivals and results. Best size 2400 × 1350 px (16:9), subject centred."
                defaultValue={(s as { image_url?: string | null }).image_url ?? ""}
                wide
              />
            )}

            <label className="label cursor-pointer justify-start gap-3">
              <input type="checkbox" name="has_festivals" defaultChecked={s.has_festivals} className="checkbox checkbox-sm" />
              <span className="label-text text-sm">Runs as festivals (group events at one casino into festivals)</span>
            </label>
            <label className="label cursor-pointer justify-start gap-3">
              <input type="checkbox" name="is_active" defaultChecked={s.is_active} className="checkbox checkbox-sm" />
              <span className="label-text text-sm">Active (inactive series don&apos;t match new events)</span>
            </label>

            <button className="btn btn-primary btn-sm">Save &amp; re-run detection</button>
          </div>
        </form>

        {/* Festivals / events */}
        <div className="space-y-6 lg:col-span-3">
          {s.has_festivals && (
            <section className="panel overflow-hidden">
              <h2 className="font-display font-semibold border-b border-base-content/[0.07] px-4 py-3 text-base">Festivals</h2>
              <table className="table table-sm w-full">
                <tbody>
                  {(festivals || []).map((f: any) => (
                    <tr key={f.id} className="hover:bg-base-200/30">
                      <td>
                        <Link href={`/admin/festivals/${f.id}`} className="font-bold hover:text-primary">{f.label}</Link>
                        <div className="text-xs opacity-50">{f.season?.name}</div>
                      </td>
                      <td className="text-xs opacity-70">{fmt(f.start_date)} – {fmt(f.end_date)}</td>
                      <td className="text-right font-mono text-xs">{f.events?.[0]?.count ?? 0} events</td>
                    </tr>
                  ))}
                  {!festivals?.length && (
                    <tr><td className="py-6 text-center text-xs opacity-50">No festivals detected yet.</td></tr>
                  )}
                </tbody>
              </table>
            </section>
          )}

          <section className="panel overflow-hidden">
            <h2 className="font-display font-semibold border-b border-base-content/[0.07] px-4 py-3 text-base">
              Latest events {eventCount && eventCount > 40 ? `(40 of ${eventCount})` : ""}
            </h2>
            <ul className="divide-y divide-base-content/[0.06] text-sm">
              {(singles || []).map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-4 px-4 py-2">
                  <Link href={`/admin/events/${e.id}`} className="truncate hover:text-primary">{e.tournament_name}</Link>
                  <span className="shrink-0 text-xs opacity-50">{e.casino} · {fmt(e.start_date)}</span>
                </li>
              ))}
            </ul>
          </section>

          <form action={deleteSeriesAction} className="text-right">
            <input type="hidden" name="id" value={s.id} />
            <button className="btn btn-error btn-outline btn-xs">Delete series</button>
            <p className="mt-1 text-[11px] opacity-50">Events keep their results and just lose this series.</p>
          </form>
        </div>
      </div>
    </div>
  );
}
