'use server'

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";

async function db() {
  const gate = await requireAdmin();
  if (!gate.ok) throw new Error(gate.error);
  return gate.supabase;
}

export async function addPrizeAction(formData: FormData) {
  const supabase = await db();
  const seasonId = Number(formData.get("season_id"));
  const league = String(formData.get("league") ?? "").trim();
  const from = Number(formData.get("position_from"));
  const to = Number(formData.get("position_to") || from);
  const description = String(formData.get("prize_description") ?? "").trim();
  const amount = formData.get("prize_amount") ? Number(formData.get("prize_amount")) : null;

  if (!Number.isFinite(seasonId) || !league) throw new Error("Missing season or league.");
  if (!Number.isInteger(from) || from < 1 || !Number.isInteger(to) || to < from) throw new Error("Positions must be whole numbers, from ≤ to.");
  if (!description && amount == null) throw new Error("Give a description or an amount.");

  const { error } = await supabase.from("season_prizes").insert({
    season_id: seasonId,
    league,
    position_from: from,
    position_to: to,
    prize_description: description || `£${amount!.toLocaleString("en-GB")}`,
    prize_amount: amount,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/seasons/${seasonId}/prizes`);
  revalidatePath("/leaderboards");
}

export async function deletePrizeAction(formData: FormData) {
  const supabase = await db();
  const id = Number(formData.get("id"));
  const seasonId = Number(formData.get("season_id"));
  const { error } = await supabase.from("season_prizes").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/seasons/${seasonId}/prizes`);
  revalidatePath("/leaderboards");
}
