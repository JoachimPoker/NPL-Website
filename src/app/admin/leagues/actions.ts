'use server'

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";

/** Save one league's logo (shared by every season of that league). */
export async function saveLeagueBrandAction(formData: FormData) {
  const g = await requireAdmin();
  if (!g.ok) throw new Error(g.error);

  const slug = String(formData.get("slug") ?? "");
  const logo = String(formData.get("logo_url") ?? "").trim() || null;
  if (!slug) throw new Error("Missing league");
  if (logo && !/^https:\/\//i.test(logo)) throw new Error("The logo must be an https:// address.");

  const { error } = await g.supabase
    .from("league_brands")
    .update({ logo_url: logo, updated_at: new Date().toISOString() })
    .eq("slug", slug);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/leagues");
  revalidatePath("/", "layout");
}
