'use server'

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { isAdminUser } from "@/lib/isAdmin";

export type UserState = { ok?: string; error?: string };

/**
 * Add an admin by email. Public sign-up is closed, so this is how new staff get an account: the account is
 * created confirmed and given the admin role; they then choose a password with "Forgot password?" on the
 * sign-in page. An existing account is simply given the admin role.
 */
export async function addAdminAction(_prev: UserState, formData: FormData): Promise<UserState> {
  const g = await requireAdmin();
  if (!g.ok) return { error: "Only admins can add admins." };
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };

  const db = createSupabaseAdminClient();
  const { data: list, error: listErr } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listErr) return { error: listErr.message };
  const existing = list.users.find((u) => u.email?.toLowerCase() === email);

  if (existing) {
    if (isAdminUser(existing)) return { error: `${email} is already an admin.` };
    const { error } = await db.auth.admin.updateUserById(existing.id, { app_metadata: { ...existing.app_metadata, role: "admin" } });
    if (error) return { error: error.message };
    revalidatePath("/admin/users");
    return { ok: `${email} is now an admin.` };
  }

  const { error } = await db.auth.admin.createUser({ email, email_confirm: true, app_metadata: { role: "admin" } });
  if (error) return { error: error.message };
  revalidatePath("/admin/users");
  return { ok: `Account created for ${email}. Ask them to open the sign-in page, choose "Forgot password?" and set a password.` };
}

/** Take away someone's admin role (their account stays, with no access). You can't remove your own. */
export async function removeAdminAction(formData: FormData) {
  const g = await requireAdmin();
  if (!g.ok) throw new Error(g.error);
  const id = String(formData.get("id") ?? "");
  if (id === g.user.id) throw new Error("You can't remove your own admin access.");
  const db = createSupabaseAdminClient();
  const { data, error: getErr } = await db.auth.admin.getUserById(id);
  if (getErr || !data.user) throw new Error(getErr?.message ?? "User not found.");
  const meta = { ...data.user.app_metadata } as Record<string, unknown>;
  delete meta.role;
  if (Array.isArray(meta.roles)) meta.roles = (meta.roles as string[]).filter((r) => r !== "admin");
  const { error } = await db.auth.admin.updateUserById(id, { app_metadata: meta });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/users");
}

/** Delete an account that has no admin access (e.g. one made through the old public sign-up). */
export async function deleteUserAction(formData: FormData) {
  const g = await requireAdmin();
  if (!g.ok) throw new Error(g.error);
  const id = String(formData.get("id") ?? "");
  if (id === g.user.id) throw new Error("You can't delete your own account here.");
  const db = createSupabaseAdminClient();
  const { data } = await db.auth.admin.getUserById(id);
  if (data.user && isAdminUser(data.user)) throw new Error("Remove admin access before deleting the account.");
  const { error } = await db.auth.admin.deleteUser(id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/users");
}
