'use server'

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/adminAuth";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { ACHIEVEMENT_TYPES, conditionField } from "@/lib/badges";

const TIERS = ["bronze", "silver", "gold", "emerald", "diamond", "purple"];
const RARITIES = ["common", "uncommon", "rare", "epic", "legendary", "mythic"];

function text(v: FormDataEntryValue | null) {
  const s = (v ?? "").toString().trim();
  return s === "" ? null : s;
}

/** Admin check, then the service-role client (badge tables are server-write only). */
async function adminDb() {
  const gate = await requireAdmin();
  if (!gate.ok) throw new Error(gate.error);
  return { db: createSupabaseAdminClient(), user: gate.user };
}

function refresh() {
  revalidatePath("/admin/badges", "layout");
  revalidatePath("/badges");
  revalidatePath("/players", "layout");
  revalidateTag("careers", "max"); // cached player careers (src/lib/career.ts)
}

export async function saveBadgeAction(formData: FormData) {
  const { db } = await adminDb();

  const id = Number(formData.get("id"));
  const isNew = !Number.isFinite(id) || id <= 0;
  const name = text(formData.get("name"));
  const description = text(formData.get("description"));
  const conditionType = text(formData.get("condition_type")) ?? "special";
  const tier = text(formData.get("tier")) ?? "bronze";
  const rarity = text(formData.get("rarity"));
  if (!name || !description) throw new Error("Name and description are required.");
  if (!TIERS.includes(tier)) throw new Error("Unknown tier.");
  if (rarity && !RARITIES.includes(rarity)) throw new Error("Unknown rarity.");

  const imageUrl = text(formData.get("image_url"));
  if (imageUrl && !/^https?:\/\//i.test(imageUrl)) throw new Error("The image must be an https:// address.");

  // Achievements compare a number ("at least"); league titles a range of finishing positions.
  const { field } = conditionField(conditionType);
  let conditionValue: Record<string, number> = {};
  if (field === "min") {
    const threshold = Number(formData.get("threshold"));
    if (!Number.isFinite(threshold) || threshold <= 0) throw new Error("Enter the number needed for this level.");
    conditionValue = { min: threshold };
  } else if (field === "ranks") {
    const from = Number(formData.get("min_rank")) || 1;
    const to = Number(formData.get("max_rank")) || from;
    if (from < 1 || to < from) throw new Error("Positions must go from a lower to a higher (or equal) number, e.g. 2 to 3.");
    conditionValue = { min_rank: from, max_rank: to };
  }

  const row = {
    name,
    description,
    category: text(formData.get("category")) ?? "Special",
    tier,
    rarity,
    condition_type: conditionType,
    condition_value: conditionValue,
    kind: ACHIEVEMENT_TYPES.includes(conditionType) ? "achievement" : "badge",
    // Badges (titles) have no tier; the column is required, so they all share one value.
    ...(ACHIEVEMENT_TYPES.includes(conditionType) ? {} : { tier: "gold" }),
    icon: text(formData.get("icon")) ?? "award",
    image_url: imageUrl,
    display_order: Number(formData.get("display_order")) || 100,
    is_active: formData.get("is_active") === "on",
    updated_at: new Date().toISOString(),
  };

  if (isNew) {
    const key = (text(formData.get("key")) ?? name).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (!key) throw new Error("A key is required.");
    const { error } = await db.from("badge_definitions").insert({ ...row, key, is_active: true });
    if (error) throw new Error(error.code === "23505" ? `A badge with key "${key}" already exists.` : error.message);
  } else {
    const { error } = await db.from("badge_definitions").update(row).eq("id", id);
    if (error) throw new Error(error.message);
  }

  // Thresholds may have changed who qualifies.
  if (conditionType !== "special") await db.rpc("award_badges");

  refresh();
  redirect("/admin/badges");
}

export async function recalculateBadgesAction() {
  const { db } = await adminDb();
  const { data, error } = await db.rpc("award_badges");
  if (error) throw new Error(error.message);
  refresh();
  redirect(`/admin/badges?recalc=${encodeURIComponent(JSON.stringify(data))}`);
}

/** Give a badge by hand (special badges, or a one-off). Hand awards are never removed automatically. */
export async function awardBadgeAction(formData: FormData) {
  const { db, user } = await adminDb();

  const playerId = Number(formData.get("player_id"));
  const key = text(formData.get("badge_key"));
  // Optional occasion for repeatable badges, e.g. "Sep 2026" for Player of the Month.
  const occasion = text(formData.get("occasion"));
  const year = Number(occasion?.match(/\b(20\d{2})\b/)?.[1]) || null;
  if (!Number.isFinite(playerId) || playerId <= 0) throw new Error("Pick a player.");
  if (!key) throw new Error("Pick a badge.");

  const { data: def } = await db.from("badge_definitions").select("key, name").eq("key", key).maybeSingle();
  if (!def) throw new Error("Unknown badge.");
  const { data: player } = await db.from("players").select("id").eq("id", playerId).maybeSingle();
  if (!player) throw new Error(`No player with id ${playerId}.`);

  // Repeatable badges are stored once per occasion ("player_of_month@sep-2026").
  const slug = occasion?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const awardKey = slug ? `${def.key}@${slug}` : def.key;
  const { error } = await db.from("player_badges").insert({
    player_id: playerId,
    badge_key: awardKey,
    badge_name: occasion ? `${def.name} · ${occasion}` : def.name,
    occasion,
    season_year: year,
    awarded_by: user.email ?? user.id,
  });
  if (error) throw new Error(error.code === "23505" ? "That player already has this badge." : error.message);

  refresh();
  redirect("/admin/badges?awarded=1");
}

export async function revokeAwardAction(formData: FormData) {
  const { db } = await adminDb();
  const id = Number(formData.get("award_id"));
  if (!Number.isFinite(id)) throw new Error("Missing award id");
  const { error } = await db.from("player_badges").delete().eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
  redirect("/admin/badges");
}
