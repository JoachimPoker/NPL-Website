'use server'

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";

/** Mark a contact message as dealt with (or reopen it). */
export async function setMessageHandledAction(formData: FormData) {
  const g = await requireAdmin();
  if (!g.ok) throw new Error(g.error);
  const id = String(formData.get("id") ?? "");
  const handled = formData.get("handled") === "1";
  const { error } = await g.supabase
    .from("contact_messages")
    .update(handled ? { handled_at: new Date().toISOString(), handled_by: g.user.email ?? "admin" } : { handled_at: null, handled_by: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/messages");
  revalidatePath("/admin");
}

/** Delete a message (the privacy notice promises deletion 12 months after it's dealt with). */
export async function deleteMessageAction(formData: FormData) {
  const g = await requireAdmin();
  if (!g.ok) throw new Error(g.error);
  const { error } = await g.supabase.from("contact_messages").delete().eq("id", String(formData.get("id") ?? ""));
  if (error) throw new Error(error.message);
  revalidatePath("/admin/messages");
  revalidatePath("/admin");
}

/** Delete every message dealt with more than 12 months ago. */
export async function purgeOldMessagesAction() {
  const g = await requireAdmin();
  if (!g.ok) throw new Error(g.error);
  const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await g.supabase.from("contact_messages").delete().lt("handled_at", cutoff);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/messages");
}
