'use server'

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { DEFAULT_IMAGES } from "@/lib/siteImages";

/** Save one photo spot's replacement, or (with an empty URL) go back to the built-in default. */
export async function saveSiteImageAction(formData: FormData) {
  const g = await requireAdmin();
  if (!g.ok) throw new Error(g.error);

  const key = String(formData.get("key") ?? "");
  const url = String(formData.get("url") ?? "").trim();
  if (!(key in DEFAULT_IMAGES)) throw new Error("Unknown photo spot.");
  if (url && !/^https:\/\//i.test(url)) throw new Error("The image must be an https:// address.");

  const { error } = url
    ? await g.supabase.from("site_images").upsert({ key, url, updated_at: new Date().toISOString() })
    : await g.supabase.from("site_images").delete().eq("key", key);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/images");
  revalidatePath("/", "layout");
}

/** Save one venue's photo, or (with an empty URL) remove it so the venue uses the default Venues photo. */
export async function saveVenueImageAction(formData: FormData) {
  const g = await requireAdmin();
  if (!g.ok) throw new Error(g.error);

  const casino = String(formData.get("casino") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  if (!casino) throw new Error("Missing venue.");
  if (url && !/^https:\/\//i.test(url)) throw new Error("The image must be an https:// address.");

  const { error } = url
    ? await g.supabase.from("venue_images").upsert({ casino, url, updated_at: new Date().toISOString() })
    : await g.supabase.from("venue_images").delete().eq("casino", casino);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/images");
  revalidatePath("/venues", "layout");
}
