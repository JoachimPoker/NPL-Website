'use server'

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/adminAuth";

function text(v: FormDataEntryValue | null) {
  const s = (v ?? "").toString().trim();
  return s === "" ? null : s;
}

// Links and images are rendered on the public site: only allow http(s) URLs.
function url(v: FormDataEntryValue | null) {
  const s = text(v);
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol === "https:" || u.protocol === "http:") return u.toString();
  } catch {}
  throw new Error(`"${s}" is not a valid web address (it must start with https://).`);
}

export async function saveNewsAction(formData: FormData) {
  const gate = await requireAdmin();
  if (!gate.ok) throw new Error(gate.error);

  const id = Number(formData.get("id"));
  const title = text(formData.get("title"));
  if (!title) throw new Error("A title is required.");

  const publishedAt = text(formData.get("published_at"));
  const row = {
    title,
    category: text(formData.get("category")),
    excerpt: text(formData.get("excerpt")),
    content: text(formData.get("content")),
    image_url: url(formData.get("image_url")),
    social_link: url(formData.get("social_link")),
    published_at: publishedAt ? new Date(publishedAt).toISOString() : new Date().toISOString(),
    is_published: formData.get("is_published") === "on",
    is_featured: formData.get("is_featured") === "on",
    updated_at: new Date().toISOString(),
  };

  const db = gate.supabase;
  // Only one featured story at a time.
  if (row.is_featured) {
    const { error } = await db.from("news").update({ is_featured: false }).neq("id", Number.isFinite(id) ? id : -1);
    if (error) throw new Error(error.message);
  }

  const { error } = Number.isFinite(id) && id > 0
    ? await db.from("news").update(row).eq("id", id)
    : await db.from("news").insert(row);
  if (error) throw new Error(error.message);

  revalidatePath("/news", "layout");
  revalidatePath("/admin/news");
  redirect("/admin/news");
}

export async function deleteNewsAction(formData: FormData) {
  const gate = await requireAdmin();
  if (!gate.ok) throw new Error(gate.error);

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) throw new Error("Missing id");

  const { error } = await gate.supabase.from("news").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/news", "layout");
  revalidatePath("/admin/news");
  redirect("/admin/news");
}
