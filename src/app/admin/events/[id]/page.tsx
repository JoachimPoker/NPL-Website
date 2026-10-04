import { Check } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { updateEventAction } from "../actions";

export const dynamic = "force-dynamic";

const gbp = (n: number | null | undefined) =>
  n == null ? "–" : n.toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });

export default async function AdminEventPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const eventId = Number(id);
  if (!Number.isFinite(eventId)) notFound();

  const supabase = await createSupabaseServerClient();

  const [{ data: ev }, { data: results }, { data: series }, { data: festivals }, { data: venues }] = await Promise.all([
    supabase
      .from("events")
      .select("*, season:seasons(name)")
      .eq("id", eventId)
      .maybeSingle(),
    supabase
      .from("results")
      .select("id, finish_position, points, penalty_points, prize_amount, is_deleted, player:players(id, forename, surname, gdpr)")
      .eq("event_id", eventId)
      .order("finish_position", { ascending: true }),
    supabase.from("series").select("id, name").order("name"),
    supabase.from("festivals").select("id, label, start_date").order("start_date", { ascending: false }).limit(300),
    supabase.from("venue_summary").select("casino").order("events", { ascending: false }),
  ]);
  if (!ev) notFound();
  // "2024-02-21T00:30:00" → the datetime-local format; the column has no time zone, so no conversion.
  const startLocal = ev.start_date ? ev.start_date.replace(" ", "T").slice(0, 16) : "";

  const live = (results || []).filter((r) => !r.is_deleted);
  const removed = (results || []).filter((r) => r.is_deleted);
  const prizesPaid = live.reduce((s, r) => s + (Number(r.prize_amount) || 0), 0);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      <div className="flex flex-col gap-4 border-b border-base-content/[0.07] pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <Link href="/admin/events" className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-[0.9375rem] font-medium text-season-ink/75 hover:text-season-ink"><span aria-hidden="true">←</span> Events</Link>
          <p className="mb-1 text-[0.9375rem] text-season-muted">{ev.season?.name ?? "No season"} · Event #{ev.id}</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{ev.tournament_name ?? "Unnamed event"}</h1>
          <p className="mt-1 text-sm text-base-content/60">
            {ev.casino ?? "Unknown venue"} ·{" "}
            {ev.start_date
              ? new Date(ev.start_date).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })
              : "No date"}{" "}
            · Buy-in {gbp(ev.buy_in)}
            {ev.is_deleted && <span className="badge badge-error badge-sm ml-2">Not in latest report</span>}
          </p>
        </div>
        <Link href="/admin/events" className="btn btn-ghost btn-sm">← Events</Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Settings */}
        <form action={updateEventAction} className="panel h-fit">
          <div className="card-body space-y-4 p-6">
            <h2 className="font-display text-lg font-semibold">Event settings</h2>
            <input type="hidden" name="id" value={ev.id} />
            <input type="hidden" name="was_high_roller" value={String(!!ev.is_high_roller)} />
            <input type="hidden" name="was_series_id" value={ev.series_id ?? ""} />
            <input type="hidden" name="was_festival_id" value={ev.festival_id ?? ""} />
            <input type="hidden" name="was_tournament_name" value={ev.tournament_name ?? ""} />
            <input type="hidden" name="was_casino" value={ev.casino ?? ""} />
            <input type="hidden" name="was_start_date" value={startLocal} />
            <input type="hidden" name="was_buy_in" value={ev.buy_in == null ? "" : String(Number(ev.buy_in))} />

            <label className="form-control">
              <span className="label-text mb-1 text-xs font-bold">Name</span>
              <input name="tournament_name" required defaultValue={ev.tournament_name ?? ""} className="input input-bordered input-sm" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="form-control">
                <span className="label-text mb-1 text-xs font-bold">Venue</span>
                <input name="casino" list="venue-list" defaultValue={ev.casino ?? ""} className="input input-bordered input-sm" />
              </label>
              <label className="form-control">
                <span className="label-text mb-1 text-xs font-bold">Buy-in (£)</span>
                <input name="buy_in" type="number" min="0" step="any" defaultValue={ev.buy_in == null ? "" : Number(ev.buy_in)} className="input input-bordered input-sm" />
              </label>
            </div>
            <datalist id="venue-list">{(venues || []).map((v) => <option key={v.casino} value={v.casino} />)}</datalist>
            <label className="form-control">
              <span className="label-text mb-1 text-xs font-bold">Date &amp; time</span>
              <input name="start_date" type="datetime-local" defaultValue={startLocal} className="input input-bordered input-sm" />
            </label>
            <p className="-mt-2 text-[11px] text-base-content/50">
              {ev.details_locked
                ? "Corrected by hand: weekly imports keep these details. Results still follow the report."
                : "From the weekly report. Changing anything here pins your correction for future imports."}
            </p>
            {ev.details_locked && (
              <label className="label cursor-pointer justify-start gap-3">
                <input type="checkbox" name="unlock_details" className="checkbox checkbox-xs" />
                <span className="label-text text-xs">Use the report&apos;s details again from the next import</span>
              </label>
            )}

            <div className="divider my-0" />

            <label className="form-control">
              <span className="label-text mb-1 text-xs font-bold">Series</span>
              <select name="series_id" defaultValue={ev.series_id ?? ""} className="select select-bordered select-sm">
                <option value="">— No series —</option>
                {(series || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>

            <label className="form-control">
              <span className="label-text mb-1 text-xs font-bold">Festival</span>
              <select name="festival_id" defaultValue={ev.festival_id ?? ""} className="select select-bordered select-sm">
                <option value="">— No festival —</option>
                {(festivals || []).map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </label>

            <p className="-mt-2 text-[11px] text-base-content/50">
              {ev.series_locked || ev.festival_locked
                ? "Series/festival set by hand: detection won't change them."
                : "Series and festival are detected automatically from the name, casino and dates."}
            </p>
            {(ev.series_locked || ev.festival_locked) && (
              <label className="label cursor-pointer justify-start gap-3">
                <input type="checkbox" name="auto_series" className="checkbox checkbox-xs" />
                <span className="label-text text-xs">Let detection decide series &amp; festival again</span>
              </label>
            )}

            <label className="label cursor-pointer justify-start gap-3">
              <input type="checkbox" name="is_high_roller" defaultChecked={!!ev.is_high_roller} className="checkbox checkbox-primary checkbox-sm" />
              <span className="label-text">High Roller event</span>
            </label>
            <p className="-mt-2 text-[11px] text-base-content/50">
              {ev.is_high_roller_locked
                ? "Set by hand: weekly imports won't change it."
                : "Set automatically when the name contains “High Roller”. Changing it here pins your choice."}
            </p>
            {ev.is_high_roller_locked && (
              <label className="label cursor-pointer justify-start gap-3">
                <input type="checkbox" name="unlock_high_roller" className="checkbox checkbox-xs" />
                <span className="label-text text-xs">Go back to automatic</span>
              </label>
            )}

            <button className="btn btn-primary btn-sm">Save</button>
            <p className="text-[11px] text-base-content/40">
              Results come from the weekly report and update on each import.
            </p>
          </div>
        </form>

        {/* Results */}
        <div className="space-y-4 lg:col-span-2">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Cashes" value={live.length.toString()} />
            <Stat label="Prizes paid" value={gbp(prizesPaid)} />
            <Stat label="Removed rows" value={removed.length.toString()} />
          </div>

          <div className="panel overflow-x-auto">
            <table className="table table-sm w-full">
              <thead className="bg-base-200/50 text-[0.8125rem]">
                <tr>
                  <th className="w-12 text-center">#</th>
                  <th>Player</th>
                  <th className="text-right">Prize</th>
                  <th className="text-right">Points</th>
                  <th className="text-center">GDPR</th>
                </tr>
              </thead>
              <tbody>
                {(results || []).map((r) => (
                  <tr key={r.id} className={r.is_deleted ? "opacity-40 line-through" : ""}>
                    <td className="text-center font-mono">{r.finish_position ?? "–"}</td>
                    <td>
                      {r.player ? (
                        <Link href={`/admin/players/${r.player.id}`} className="hover:text-primary">
                          {[r.player.forename, r.player.surname].filter(Boolean).join(" ") || `Player ${r.player.id}`}
                        </Link>
                      ) : "Unknown"}
                    </td>
                    <td className="text-right font-mono">{r.prize_amount ? gbp(Number(r.prize_amount)) : "–"}</td>
                    <td className="text-right font-mono">
                      {Number(r.points).toFixed(2)}
                      {Number(r.penalty_points) !== 0 && (
                        <span className="ml-1 text-error" title="Penalty">{Number(r.penalty_points)}</span>
                      )}
                    </td>
                    <td className="text-center text-xs">{r.player?.gdpr ? <Check size={15} className="mx-auto text-season-up" aria-label="Consent given" /> : <span className="opacity-60">masked</span>}</td>
                  </tr>
                ))}
                {!results?.length && (
                  <tr><td colSpan={5} className="py-8 text-center text-sm opacity-50">No results.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-4">
      <div className="text-[0.8125rem] text-season-muted">{label}</div>
      <div className="mt-1 font-mono text-lg">{value}</div>
    </div>
  );
}
