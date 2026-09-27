'use server'

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/adminAuth";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

const text = (v: FormDataEntryValue | null) => {
  const s = (v ?? "").toString().trim();
  return s === "" ? null : s;
};

async function gate() {
  const g = await requireAdmin();
  if (!g.ok) throw new Error(g.error);
  return g.supabase;
}

/** The season a date falls in (by the season's dates, else by year). */
async function seasonFor(db: Awaited<ReturnType<typeof gate>>, date: string) {
  const { data: seasons } = await db.from("seasons").select("id, year, start_date, end_date");
  const byDates = (seasons || []).find((s) => s.start_date && s.end_date && date >= s.start_date.slice(0, 10) && date <= s.end_date.slice(0, 10));
  return byDates?.id ?? (seasons || []).find((s) => String(s.year) === date.slice(0, 4))?.id ?? null;
}

/** Events of this series at this venue within the dates (the "series + venue + dates" rule). */
async function matchingEvents(db: Awaited<ReturnType<typeof gate>>, f: { series_id: number | null; casino: string | null; start: string; end: string }) {
  let q = db
    .from("events")
    .select("id")
    .eq("is_deleted", false)
    .gte("start_date", `${f.start}T00:00:00`)
    .lte("start_date", `${f.end}T23:59:59`);
  q = f.series_id ? q.eq("series_id", f.series_id) : q.is("series_id", null);
  q = f.casino ? q.eq("casino", f.casino) : q.is("casino", null);
  const { data } = await q;
  return (data || []).map((e) => e.id as number);
}

/** Re-run detection and badges after festival membership changes. */
async function refreshDerived(seasonIds: (number | null)[]) {
  const admin = createSupabaseAdminClient();
  for (const s of [...new Set(seasonIds.filter((x): x is number => !!x))]) {
    const { error } = await admin.rpc("auto_assign_series", { p_season_id: s });
    if (error) throw new Error(error.message);
  }
  const { error } = await admin.rpc("award_badges");
  if (error) throw new Error(error.message);
  revalidatePath("/events", "layout");
  revalidatePath("/badges");
  revalidatePath("/admin/festivals", "layout");
}

/**
 * Create or update a festival. Saving here makes it hand-made: detection never renames,
 * re-dates or deletes it, and the ticked events are pinned to it.
 *   intent=fill  also adds every event of the series at the venue within the dates.
 */
export async function saveFestivalAction(formData: FormData) {
  const db = await gate();

  const id = text(formData.get("id"));
  const label = text(formData.get("label"));
  const seriesId = text(formData.get("series_id")) ? Number(formData.get("series_id")) : null;
  const casino = text(formData.get("casino"));
  const city = text(formData.get("city"));
  const start = text(formData.get("start_date"));
  const end = text(formData.get("end_date")) ?? start;
  const intent = text(formData.get("intent"));
  if (!label) throw new Error("A name is required.");
  if (!start || !end) throw new Error("Start and end dates are required.");
  if (end < start) throw new Error("The end date can't be before the start date.");

  const seasonId = await seasonFor(db, start);
  const row = {
    label,
    series_id: seriesId,
    casino,
    city: city ?? casino,
    start_date: start,
    end_date: end,
    season_id: seasonId,
    is_auto: false,
    label_locked: true,
    main_event_id: text(formData.get("main_event_id")) ? Number(formData.get("main_event_id")) : null,
    updated_at: new Date().toISOString(),
  };

  let festivalId = id;
  let previousSeason: number | null = null;
  if (!festivalId) {
    const { data, error } = await db.from("festivals").insert({ ...row, keywords: [] }).select("id").single();
    if (error) throw new Error(error.message);
    festivalId = data.id;
  } else {
    const { data: before } = await db.from("festivals").select("season_id").eq("id", festivalId).maybeSingle();
    previousSeason = before?.season_id ?? null;
    const { error } = await db.from("festivals").update(row).eq("id", festivalId);
    if (error) throw new Error(error.message);
  }

  // Membership: the ticked events (plus, when filling or creating, every matching event).
  const ticked = new Set(formData.getAll("event_ids").map((v) => Number(v)).filter(Number.isFinite));
  if (intent === "fill" || !id) for (const e of await matchingEvents(db, { series_id: seriesId, casino, start, end })) ticked.add(e);

  const { data: current } = await db.from("events").select("id").eq("festival_id", festivalId!);
  const currentIds = new Set((current || []).map((e) => e.id as number));
  const removed = [...currentIds].filter((e) => !ticked.has(e));
  const now = new Date().toISOString();

  if (ticked.size) {
    const { error } = await db
      .from("events")
      .update({ festival_id: festivalId, festival_locked: true, updated_at: now })
      .in("id", [...ticked]);
    if (error) throw new Error(error.message);
  }
  if (removed.length) {
    // Taken out by hand: pinned to "no festival" so detection doesn't put them back.
    const { error } = await db
      .from("events")
      .update({ festival_id: null, festival_locked: true, updated_at: now })
      .in("id", removed);
    if (error) throw new Error(error.message);
  }

  await refreshDerived([seasonId, previousSeason]);
  redirect(`/admin/festivals/${festivalId}?saved=1`);
}

/** Delete a festival. Its events are released, so detection can group them again. */
export async function deleteFestivalAction(formData: FormData) {
  const db = await gate();
  const id = text(formData.get("id"));
  if (!id) throw new Error("Missing festival.");

  const { data: f } = await db.from("festivals").select("season_id").eq("id", id).maybeSingle();
  const { error: evErr } = await db
    .from("events")
    .update({ festival_id: null, festival_locked: false, updated_at: new Date().toISOString() })
    .eq("festival_id", id);
  if (evErr) throw new Error(evErr.message);
  const { error } = await db.from("festivals").delete().eq("id", id);
  if (error) throw new Error(error.message);

  await refreshDerived([f?.season_id ?? null]);
  redirect("/admin/festivals?deleted=1");
}
