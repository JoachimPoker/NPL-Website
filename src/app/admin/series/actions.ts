'use server'

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/adminAuth";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

function text(v: FormDataEntryValue | null) {
  const s = (v ?? "").toString().trim();
  return s === "" ? null : s;
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function gate() {
  const g = await requireAdmin();
  if (!g.ok) throw new Error(g.error);
  return g.supabase;
}

async function checkPattern(db: Awaited<ReturnType<typeof gate>>, pattern: string | null) {
  if (!pattern) return;
  const { data, error } = await db.rpc("is_valid_regex", { p: pattern });
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`"${pattern}" is not a valid pattern.`);
}

/** Re-run series/festival detection (optionally for one season). */
async function autoAssign(seasonId?: number) {
  const { data, error } = await createSupabaseAdminClient().rpc("auto_assign_series", {
    p_season_id: seasonId ?? null,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function saveSeriesAction(formData: FormData) {
  const db = await gate();

  const id = Number(formData.get("id"));
  const isNew = !Number.isFinite(id) || id <= 0;
  const name = text(formData.get("name"));
  if (!name) throw new Error("A name is required.");
  const pattern = text(formData.get("match_pattern"));
  await checkPattern(db, pattern);

  const logo = text(formData.get("logo_url"));
  if (logo && !/^https?:\/\//i.test(logo)) throw new Error("The logo must be an https:// address.");

  const row = {
    name,
    slug: text(formData.get("slug")) ? slugify(text(formData.get("slug"))!) : slugify(name),
    description: text(formData.get("description")) ?? "",
    match_pattern: pattern,
    has_festivals: formData.get("has_festivals") === "on",
    is_active: isNew ? true : formData.get("is_active") === "on",
    sort_order: Number(formData.get("sort_order")) || 100,
    logo_url: logo,
    updated_at: new Date().toISOString(),
  };

  // Detection only depends on these; logo/name/description edits don't need a re-run.
  const { data: before } = isNew
    ? { data: null }
    : await db.from("series").select("match_pattern, has_festivals, is_active, sort_order, slug").eq("id", id).maybeSingle();
  const affectsDetection =
    !before ||
    before.match_pattern !== row.match_pattern ||
    before.has_festivals !== row.has_festivals ||
    before.is_active !== row.is_active ||
    before.sort_order !== row.sort_order ||
    (before.slug === "others") !== (row.slug === "others");

  let seriesId = id;
  if (isNew) {
    const { data, error } = await db.from("series").insert(row).select("id").single();
    if (error) throw new Error(error.code === "23505" ? `A series with the slug "${row.slug}" already exists.` : error.message);
    seriesId = data.id;
  } else {
    const { error } = await db.from("series").update(row).eq("id", id);
    if (error) throw new Error(error.code === "23505" ? `A series with the slug "${row.slug}" already exists.` : error.message);
  }

  // Patterns and festival settings change which events belong where.
  if (affectsDetection) await autoAssign();

  revalidatePath("/admin/series", "layout");
  revalidatePath("/events", "layout");
  redirect(`/admin/series/${seriesId}`);
}

export async function deleteSeriesAction(formData: FormData) {
  const db = await gate();
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) throw new Error("Missing id");

  // Events keep their results; they just lose the series (and its auto festivals).
  await db.from("events").update({ series_id: null, series_locked: false, festival_locked: false }).eq("series_id", id);
  await db.from("festivals").delete().eq("series_id", id);
  const { error } = await db.from("series").delete().eq("id", id);
  if (error) throw new Error(error.message);

  await autoAssign();
  revalidatePath("/admin/series", "layout");
  revalidatePath("/events", "layout");
  redirect("/admin/series");
}

export async function runAutoAssignAction() {
  await gate();
  const result = await autoAssign();
  revalidatePath("/admin/series", "layout");
  revalidatePath("/events", "layout");
  redirect(`/admin/series?assigned=${encodeURIComponent(JSON.stringify(result))}`);
}
