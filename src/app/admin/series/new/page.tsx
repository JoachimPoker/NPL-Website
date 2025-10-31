// src/app/admin/series/new/page.tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const revalidate = 0;

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) redirect(`/login?next=/admin/series/new`);
  const roles: string[] = ((user.app_metadata as any)?.roles ?? []) as string[];
  const isAdmin =
    roles.includes("admin") ||
    (user.app_metadata as any)?.role === "admin" ||
    (user.user_metadata as any)?.is_admin === true;
  if (!isAdmin) redirect("/");
  return { supabase, user };
}

export default async function NewSeriesPage() {
  await requireAdmin();

  async function createSeries(formData: FormData) {
    "use server";
    const { supabase } = await requireAdmin();

    const name = String(formData.get("name") || "").trim();
    const slug = String(formData.get("slug") || "").trim().toLowerCase();
    const descriptionRaw = String(formData.get("description") || "").trim();

    if (!name || !slug) {
      // Simple guard; you could return a better error UI if you want
      redirect("/admin/series/new?error=Missing+name+or+slug");
    }

    // optional: normalize Description to comma+space list
    const description =
      descriptionRaw
        .split(",")
        .map(s => s.trim())
        .filter(Boolean)
        .join(", ") || null;

    const { data, error } = await supabase
      .from("series")
      .insert([{ name, slug, description, is_active: true }])
      .select("id")
      .single();

    if (error || !data?.id) {
      // If slug unique constraint fails, this will also land here
      redirect("/admin/series/new?error=" + encodeURIComponent(error?.message || "Failed to create series"));
    }

    redirect(`/admin/series/${data.id}`);
  }

  // Render create form
  return (
    <div className="space-y-6">
      {/* Top admin nav bar (same pattern as other admin pages) */}
      <div className="card">
        <div className="card-body flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">Admin — Series</div>
            <div className="text-xs text-neutral-500 dark:text-neutral-300">Create a new series</div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin" className="rounded-md border px-3 py-1.5 text-sm">Dashboard</Link>
            <Link href="/admin/series" className="rounded-md border px-3 py-1.5 text-sm">All Series</Link>
          </div>
        </div>
      </div>

      <form action={createSeries} className="card">
        <div className="card-body space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="block text-sm font-medium">Name</span>
              <input
                name="name"
                className="mt-1 w-full border rounded px-3 py-2"
                placeholder="UKPL"
                required
              />
            </label>

            <label className="block">
              <span className="block text-sm font-medium">Slug</span>
              <input
                name="slug"
                className="mt-1 w-full border rounded px-3 py-2"
                placeholder="ukpl"
                pattern="^[a-z0-9-]+$"
                title="lowercase letters, numbers, and dashes only"
                required
              />
            </label>
          </div>

          <label className="block">
            <span className="block text-sm font-medium">Description</span>
            <input
              name="description"
              className="mt-1 w-full border rounded px-3 py-2"
              placeholder="The UKPL is a 888 Live tournament"
            />
            <p className="mt-1 text-xs text-neutral-500">
              This is just what the series is about
            </p>
          </label>

          <div className="flex items-center gap-2">
            <button className="rounded-md border px-3 py-2 text-sm" type="submit">Create series</button>
            <Link href="/admin/series" className="rounded-md border px-3 py-2 text-sm">Cancel</Link>
          </div>
        </div>
      </form>
    </div>
  );
}
