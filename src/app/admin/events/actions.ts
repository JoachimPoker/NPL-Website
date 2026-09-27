'use server'

import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { Database } from "@/types/supabase";

type EventUpdate = Database['public']['Tables']['events']['Update'];

export async function bulkUpdateEventsAction(eventIds: number[], updates: EventUpdate) {
  const supabase = await createSupabaseServerClient();

  // 1. Auth Check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  if (!eventIds.length) return { error: "No events selected" };

  // 2. Perform Bulk Update
  // Since we are applying the SAME update to ALL selected IDs, we can do this in ONE query!
 const { error } = await supabase
    .from("events")
    // A manual High Roller choice is pinned so weekly imports don't recompute it from the name.
    .update("is_high_roller" in updates ? { ...updates, is_high_roller_locked: true } : updates)
    .in("id", eventIds.map(Number));

  if (error) {
    console.error("Bulk Update Error:", error);
    throw new Error(error.message);
  }

  // 3. Revalidate
  revalidatePath("/admin/events");
}

/**
 * Bulk: put events into a festival (or take them out with festivalId = null). Pinned, so
 * detection leaves them there. Badges are recalculated (Main Event titles may move).
 */
export async function bulkSetFestivalAction(eventIds: number[], festivalId: string | null) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  if (!eventIds.length) throw new Error("No events selected");

  const { error } = await supabase
    .from("events")
    .update({ festival_id: festivalId, festival_locked: true, updated_at: new Date().toISOString() })
    .in("id", eventIds.map(Number));
  if (error) throw new Error(error.message);

  const { error: badgeErr } = await createSupabaseAdminClient().rpc("award_badges");
  if (badgeErr) throw new Error(badgeErr.message);
  revalidatePath("/admin/events");
  revalidatePath("/admin/festivals", "layout");
  revalidatePath("/events", "layout");
}

/** Bulk: set the series of events (pinned, so detection leaves it). */
export async function bulkSetSeriesAction(eventIds: number[], seriesId: number | null) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  if (!eventIds.length) throw new Error("No events selected");

  const { error } = await supabase
    .from("events")
    .update({ series_id: seriesId, series_locked: true, updated_at: new Date().toISOString() })
    .in("id", eventIds.map(Number));
  if (error) throw new Error(error.message);

  const { error: badgeErr } = await createSupabaseAdminClient().rpc("award_badges");
  if (badgeErr) throw new Error(badgeErr.message);
  revalidatePath("/admin/events");
  revalidatePath("/events", "layout");
}

// Edit one event. Series, festival and High Roller are pinned once set by hand. Name, venue,
// date and buy-in come from the weekly report; correcting them sets details_locked so the next
// import keeps the correction (results always follow the report).
export async function updateEventAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) throw new Error("Missing event id");

  const seriesId = formData.get("series_id") ? Number(formData.get("series_id")) : null;
  const festivalId = (formData.get("festival_id") as string) || null;
  const wasSeriesId = formData.get("was_series_id") ? Number(formData.get("was_series_id")) : null;
  const wasFestivalId = (formData.get("was_festival_id") as string) || null;
  const hr = formData.get("is_high_roller") === "on";
  const wasHr = formData.get("was_high_roller") === "true";
  const backToAuto = formData.get("auto_series") === "on";

  const updates: EventUpdate = { updated_at: new Date().toISOString() };
  // Anything the admin changes by hand is pinned so series detection won't undo it.
  if (backToAuto) {
    updates.series_locked = false;
    updates.festival_locked = false;
  } else {
    if (seriesId !== wasSeriesId) {
      updates.series_id = seriesId;
      updates.series_locked = true;
    }
    if (festivalId !== wasFestivalId) {
      updates.festival_id = festivalId;
      updates.festival_locked = true;
    }
  }
  if (hr !== wasHr) {
    updates.is_high_roller = hr;
    updates.is_high_roller_locked = true;
  }
  if (formData.get("unlock_high_roller") === "on") updates.is_high_roller_locked = false;

  // Details: only touched when something actually changed.
  const text = (k: string) => String(formData.get(k) ?? "").trim();
  if (formData.get("unlock_details") === "on") {
    updates.details_locked = false;
  } else if (formData.has("tournament_name")) {
    const name = text("tournament_name");
    const casino = text("casino") || null;
    const start = text("start_date") || null; // datetime-local, stored as local time like the report
    const buyIn = text("buy_in") === "" ? null : Number(text("buy_in"));
    if (!name) throw new Error("The event needs a name");
    if (buyIn != null && (!Number.isFinite(buyIn) || buyIn < 0)) throw new Error("Buy-in must be a positive number");
    const changed =
      name !== text("was_tournament_name") ||
      (casino ?? "") !== text("was_casino") ||
      (start ?? "") !== text("was_start_date") ||
      (buyIn == null ? "" : String(buyIn)) !== text("was_buy_in");
    if (changed) {
      Object.assign(updates, {
        tournament_name: name,
        casino,
        start_date: start,
        buy_in: buyIn,
        is_low_roller: buyIn != null && buyIn <= 300,
        search_text: [name, casino].filter(Boolean).join(" ").toLowerCase(),
        details_locked: true,
      });
    }
  }

  const { data: ev, error } = await supabase.from("events").update(updates).eq("id", id).select("season_id").single();
  if (error) throw new Error(error.message);

  if (backToAuto) {
    const { error: aaErr } = await createSupabaseAdminClient().rpc("auto_assign_series", { p_season_id: ev.season_id });
    if (aaErr) throw new Error(aaErr.message);
  }

  revalidatePath(`/admin/events/${id}`);
  revalidatePath("/admin/events");
  revalidatePath(`/events/e/${id}`);
}