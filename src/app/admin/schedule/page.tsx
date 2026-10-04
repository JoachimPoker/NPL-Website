import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { dateRange } from "@/lib/tournaments";
import { saveUpcomingAction, deleteUpcomingAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminSchedulePage(props: { searchParams: Promise<{ edit?: string }> }) {
  const sp = await props.searchParams;
  const supabase = await createSupabaseServerClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: items }, { data: series }, { data: venues }] = await Promise.all([
    supabase.from("upcoming_events").select("*").order("start_date", { ascending: false }),
    supabase.from("series").select("id, name").eq("is_active", true).order("sort_order"),
    supabase.from("venue_summary").select("casino").order("events", { ascending: false }),
  ]);
  const editing = sp.edit ? (items || []).find((i) => String(i.id) === sp.edit) ?? null : null;
  const seriesName = new Map((series || []).map((s) => [s.id, s.name]));
  const upcoming = (items || []).filter((i) => (i.end_date ?? i.start_date) >= today).reverse();
  const past = (items || []).filter((i) => (i.end_date ?? i.start_date) < today);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      <div className="border-b border-base-content/[0.07] pb-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Schedule</h1>
        <p className="max-w-2xl text-sm text-base-content/60">
          Upcoming festivals and events for the &ldquo;Coming up&rdquo; sections on the home page, Tournaments,
          series and venue pages. They disappear from the site once their last day has passed.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        <form action={saveUpcomingAction} className="panel h-fit lg:col-span-2">
          <div className="card-body space-y-3 p-5">
            <h2 className="font-display text-lg font-semibold">{editing ? "Edit event" : "Add an event"}</h2>
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <input name="title" required defaultValue={editing?.title ?? ""} placeholder="e.g. GUKPT Luton" className="input input-bordered input-sm w-full" aria-label="Title" />
            <select name="series_id" defaultValue={editing?.series_id ?? ""} className="select select-bordered select-sm w-full" aria-label="Series">
              <option value="">No series</option>
              {(series || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input name="casino" list="venue-list" defaultValue={editing?.casino ?? ""} placeholder="Venue" className="input input-bordered input-sm w-full" aria-label="Venue" />
              <input name="city" defaultValue={editing?.city ?? ""} placeholder="City (optional)" className="input input-bordered input-sm w-full" aria-label="City" />
            </div>
            <datalist id="venue-list">{(venues || []).map((v) => <option key={v.casino} value={v.casino} />)}</datalist>
            <div className="grid grid-cols-2 gap-2">
              <label className="form-control">
                <span className="label-text mb-1 text-[11px] font-bold">Starts</span>
                <input name="start_date" type="date" required defaultValue={editing?.start_date ?? ""} className="input input-bordered input-sm w-full" />
              </label>
              <label className="form-control">
                <span className="label-text mb-1 text-[11px] font-bold">Ends (optional)</span>
                <input name="end_date" type="date" defaultValue={editing?.end_date ?? ""} className="input input-bordered input-sm w-full" />
              </label>
            </div>
            <textarea name="description" rows={3} defaultValue={editing?.description ?? ""} placeholder="Short description, e.g. main event guarantee" className="textarea textarea-bordered text-sm w-full" aria-label="Description" />
            <input name="url" type="url" defaultValue={editing?.url ?? ""} placeholder="https://… (schedule or info page)" className="input input-bordered input-sm w-full" aria-label="Link" />
            <label className="label cursor-pointer justify-start gap-2">
              <input type="checkbox" name="is_published" defaultChecked={editing?.is_published ?? true} className="checkbox checkbox-sm" />
              <span className="label-text text-sm">Show on the site</span>
            </label>
            <div className="flex gap-2">
              <button className="btn btn-primary btn-sm">{editing ? "Save" : "Add"}</button>
              {editing && <Link href="/admin/schedule" className="btn btn-ghost btn-sm">Cancel</Link>}
            </div>
          </div>
        </form>

        <div className="space-y-6 lg:col-span-3">
          {[{ title: "Coming up", list: upcoming }, { title: "Past", list: past }].map(({ title, list }) => (
            <section key={title} className="panel overflow-hidden">
              <h2 className="font-display font-semibold border-b border-base-content/[0.07] px-5 py-3 text-base">{title} ({list.length})</h2>
              <ul className="divide-y divide-base-content/[0.06]">
                {list.map((u) => (
                  <li key={u.id} className={`flex items-center justify-between gap-3 px-5 py-3 ${u.is_published ? "" : "opacity-50"}`}>
                    <div className="min-w-0">
                      <div className="truncate font-medium">{u.title}{!u.is_published && " (hidden)"}</div>
                      <div className="text-xs opacity-60">
                        {dateRange(u.start_date, u.end_date)}
                        {u.casino && ` · ${u.casino}`}
                        {u.series_id && ` · ${seriesName.get(u.series_id) ?? ""}`}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Link href={`/admin/schedule?edit=${u.id}`} className="btn btn-ghost btn-xs">Edit</Link>
                      <form action={deleteUpcomingAction}>
                        <input type="hidden" name="id" value={u.id} />
                        <button className="btn btn-ghost btn-xs text-error">Delete</button>
                      </form>
                    </div>
                  </li>
                ))}
                {!list.length && <li className="px-5 py-6 text-center text-xs opacity-50">Nothing here.</li>}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
