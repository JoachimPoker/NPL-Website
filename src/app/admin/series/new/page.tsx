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
      redirect("/admin/series/new?error=Missing+name+or+slug");
    }

    // FIX: Default to "" (empty string) instead of null
    const description =
      descriptionRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .join(", ") || "";

    const { data, error } = await supabase
      .from("series")
      .insert([{ name, slug, description, is_active: true }])
      .select("id")
      .single();

    if (error || !data?.id) {
      redirect(
        "/admin/series/new?error=" +
          encodeURIComponent(error?.message || "Failed to create series")
      );
    }

    redirect(`/admin/series/${data.id}`);
  }

  return (
    <div className="space-y-6">
      {/* Top admin nav bar */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">Admin — Series</div>
            <div className="text-xs text-base-content/70">
              Create a new series
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin" className="btn btn-ghost btn-sm">
              Dashboard
            </Link>
            <Link href="/admin/series" className="btn btn-ghost btn-sm">
              All Series
            </Link>
          </div>
        </div>
      </div>

      <form action={createSeries} className="card bg-base-100 shadow-sm">
        <div className="card-body space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="form-control">
              <span className="label">
                <span className="label-text text-sm">Name</span>
              </span>
              <input
                name="name"
                className="input input-bordered input-sm w-full"
                placeholder="UKPL"
                required
              />
            </label>

            <label className="form-control">
              <span className="label">
                <span className="label-text text-sm">Slug</span>
              </span>
              <input
                name="slug"
                className="input input-bordered input-sm w-full"
                placeholder="ukpl"
                pattern="^[a-z0-9-]+$"
                title="lowercase letters, numbers, and dashes only"
                required
              />
            </label>
          </div>

          <label className="form-control">
            <span className="label">
              <span className="label-text text-sm">Description</span>
            </span>
            <input
              name="description"
              className="input input-bordered input-sm w-full"
              placeholder="The UKPL is a 888 Live tournament"
            />
            <p className="mt-1 text-xs text-base-content/60">
              This is just what the series is about.
            </p>
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button
              className="btn btn-primary btn-sm"
              type="submit"
            >
              Create series
            </button>
            <Link
              href="/admin/series"
              className="btn btn-ghost btn-sm"
            >
              Cancel
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}