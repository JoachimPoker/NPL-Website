import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { deleteFestivalAction, saveFestivalAction, saveFestivalPhotoAction } from "../actions";
import ImageField from "@/components/admin/ImageField";

export const dynamic = "force-dynamic";

type Ev = {
  id: number; tournament_name: string | null; start_date: string | null; casino: string | null; buy_in: number | null;
  is_high_roller: boolean | null; festival_id: string | null; series_id: number | null;
};

const day = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "—";

function EventList({ title, note, events, checked, seriesName }: {
  title: string; note?: string; events: Ev[]; checked: boolean; seriesName: Map<number, string>;
}) {
  if (!events.length) return null;
  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-base-content/[0.07] px-5 py-3">
        <h2 className="font-display text-base font-semibold">{title} <span className="font-mono text-sm text-base-content/45">({events.length})</span></h2>
        {note && <p className="text-xs text-base-content/50">{note}</p>}
      </div>
      <ul className="divide-y divide-base-content/[0.06]">
        {events.map((e) => (
          <li key={e.id}>
            <label className="flex cursor-pointer items-center gap-3 px-5 py-2.5 hover:bg-base-content/[0.03]">
              <input type="checkbox" name="event_ids" value={e.id} defaultChecked={checked} className="checkbox checkbox-sm checkbox-primary" />
              <span className="w-28 shrink-0 font-mono text-xs text-base-content/55">{day(e.start_date)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{e.tournament_name}</span>
                <span className="block text-xs text-base-content/45">
                  {e.casino ?? "No venue"} · {e.series_id ? seriesName.get(e.series_id) ?? "Other" : "No series"}
                  {e.is_high_roller ? " · High Roller" : ""}
                </span>
              </span>
              <span className="shrink-0 font-mono text-xs text-base-content/55">£{Number(e.buy_in ?? 0).toLocaleString("en-GB")}</span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function FestivalEditPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const isNew = id === "new";
  const db = await createSupabaseServerClient();

  const [{ data: festival }, { data: series }, { data: venues }] = await Promise.all([
    isNew
      ? Promise.resolve({ data: null as any })
      : db.from("festivals").select("*, season:seasons(name)").eq("id", id).maybeSingle(),
    db.from("series").select("id, name, has_festivals").eq("is_active", true).order("sort_order"),
    db.from("venue_summary").select("casino").order("events", { ascending: false }),
  ]);
  if (!isNew && !festival) notFound();
  const seriesName = new Map((series || []).map((s) => [s.id, s.name]));

  // Events: in this festival, matching (series + venue + dates) but elsewhere, and anything else in the dates.
  const cols = "id, tournament_name, start_date, casino, buy_in, is_high_roller, festival_id, series_id";
  let inFestival: Ev[] = [];
  let matching: Ev[] = [];
  let others: Ev[] = [];
  if (festival) {
    const [{ data: mine }, { data: inDates }] = await Promise.all([
      db.from("events").select(cols).eq("festival_id", festival.id).eq("is_deleted", false).order("start_date"),
      db
        .from("events")
        .select(cols)
        .eq("is_deleted", false)
        .gte("start_date", `${festival.start_date}T00:00:00`)
        .lte("start_date", `${festival.end_date}T23:59:59`)
        .order("start_date")
        .limit(500),
    ]);
    inFestival = (mine || []) as Ev[];
    const rest = ((inDates || []) as Ev[]).filter((e) => e.festival_id !== festival.id);
    matching = rest.filter((e) => e.series_id === festival.series_id && (e.casino ?? null) === (festival.casino ?? null));
    others = rest.filter((e) => !matching.includes(e));
  }
  const { data: summary } = festival
    ? await db.from("festival_summary").select("main_event_name").eq("id", festival.id).maybeSingle()
    : { data: null };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 border-b border-base-content/[0.07] pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <Link href="/admin/festivals" className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-[0.9375rem] font-medium text-season-ink/75 hover:text-season-ink"><span aria-hidden="true">←</span> Festivals</Link>
          {festival && (
            <p className="mb-1 text-[0.9375rem] text-season-muted">
              {festival.season?.name ?? "No season"}{festival.is_auto ? " · detected automatically" : " · set by hand"}
            </p>
          )}
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{isNew ? "New festival" : festival.label}</h1>
          {festival && (
            <p className="text-sm text-base-content/60">
              {day(festival.start_date)} – {day(festival.end_date)} · {inFestival.length} events
            </p>
          )}
        </div>
        <Link href="/admin/festivals" className="btn btn-ghost btn-sm">← All festivals</Link>
      </div>

      {sp.saved && <div role="status" className="alert alert-success text-sm">Saved. Badges and festival pages are updated.</div>}

      <form action={saveFestivalAction} className="grid gap-8 lg:grid-cols-3">
        {festival && <input type="hidden" name="id" value={festival.id} />}

        <div className="panel h-fit lg:sticky lg:top-40">
          <div className="card-body space-y-4 p-6">
            <label className="form-control">
              <span className="label-text mb-1 text-xs font-bold">Name</span>
              <input name="label" required defaultValue={festival?.label ?? ""} placeholder="GUKPT Luton" className="input input-bordered input-sm" />
            </label>
            <label className="form-control">
              <span className="label-text mb-1 text-xs font-bold">Series</span>
              <select name="series_id" defaultValue={festival?.series_id ?? ""} className="select select-bordered select-sm">
                <option value="">No series</option>
                {(series || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className="form-control">
              <span className="label-text mb-1 text-xs font-bold">Venue</span>
              <input name="casino" list="festival-venues" defaultValue={festival?.casino ?? ""} placeholder="Luton" className="input input-bordered input-sm" />
              <datalist id="festival-venues">{(venues || []).map((v) => <option key={v.casino} value={v.casino} />)}</datalist>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="form-control">
                <span className="label-text mb-1 text-xs font-bold">Starts</span>
                <input name="start_date" type="date" required defaultValue={festival?.start_date ?? ""} className="input input-bordered input-sm" />
              </label>
              <label className="form-control">
                <span className="label-text mb-1 text-xs font-bold">Ends</span>
                <input name="end_date" type="date" required defaultValue={festival?.end_date ?? ""} className="input input-bordered input-sm" />
              </label>
            </div>
            {festival && (
              <label className="form-control">
                <span className="label-text mb-1 text-xs font-bold">Main Event</span>
                <select name="main_event_id" defaultValue={festival.main_event_id ?? ""} className="select select-bordered select-sm">
                  <option value="">Automatic{summary?.main_event_name ? ` (${summary.main_event_name})` : ""}</option>
                  {inFestival.map((e) => <option key={e.id} value={e.id}>{e.tournament_name}</option>)}
                </select>
              </label>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <button className="btn btn-primary btn-sm">{isNew ? "Create festival" : "Save"}</button>
              {!isNew && (
                <button name="intent" value="fill" className="btn btn-outline btn-sm" title="Add every event of this series at this venue within the dates">
                  Fill from dates
                </button>
              )}
            </div>
            <p className="text-[11px] text-base-content/50">
              {isNew
                ? "Creating the festival adds every event of the series at the venue within the dates. You can then tick events in or out."
                : "Ticked events belong to the festival; untick to take one out. “Fill from dates” adds every event of the series at the venue within the dates."}{" "}
              Festivals saved here are never changed by automatic detection, and new imports that fit join them automatically.
            </p>
          </div>
        </div>

        <div className="space-y-6 lg:col-span-2">
          {isNew ? (
            <div className="panel p-8 text-center text-sm text-base-content/55">
              Fill in the details and create the festival. Its events are picked up from the series, venue and dates.
            </div>
          ) : (
            <>
              <EventList title="In this festival" events={inFestival} checked seriesName={seriesName} />
              {!inFestival.length && (
                <div className="panel p-6 text-sm text-base-content/55">No events yet. Tick some below, or use &ldquo;Fill from dates&rdquo;.</div>
              )}
              <EventList
                title="Matching events not in this festival"
                note="Same series and venue within the dates. Tick to add."
                events={matching}
                checked={false}
                seriesName={seriesName}
              />
              <EventList
                title="Other events in these dates"
                note="Different series or venue, e.g. the online closer or side events. Tick to add."
                events={others}
                checked={false}
                seriesName={seriesName}
              />
            </>
          )}
        </div>
      </form>

      {/* The festival's photo: its own form, so saving it doesn't switch the festival to "set by hand". */}
      {festival && "image_url" in festival && (
        <form action={saveFestivalPhotoAction} className="panel">
          <div className="card-body gap-4 p-6">
            <input type="hidden" name="id" value={festival.id} />
            <div>
              <h2 className="text-[1.125rem] font-semibold">Festival photo</h2>
              <p className="text-[0.9375rem] text-season-muted">Shown on the home page, the festival&apos;s page, its strip in the season calendar and its events&apos; pages. Without one, the series photo is used. Best size: 2400 × 1350 px (16:9), subject in the centre.</p>
            </div>
            <ImageField name="image_url" folder="photos" label="Photo" defaultValue={(festival as { image_url?: string | null }).image_url ?? ""} wide />
            <div>
              <button className="btn btn-primary btn-sm">Save photo</button>
            </div>
          </div>
        </form>
      )}

      {festival && (
        <form action={deleteFestivalAction} className="flex items-center justify-between gap-4 rounded-[3px] border border-error/30 bg-error/[0.04] p-5">
          <input type="hidden" name="id" value={festival.id} />
          <p className="text-sm text-base-content/70">
            Delete this festival. Its events are released and automatic detection may group them again.
          </p>
          <button className="btn btn-error btn-outline btn-sm">Delete festival</button>
        </form>
      )}
    </div>
  );
}
