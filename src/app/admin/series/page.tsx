// src/app/admin/series/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const revalidate = 0;

type SeriesRow = {
  id: number;
  name: string;
  slug: string | null;
  description: string | null;
  is_active: boolean;
};

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) redirect(`/login?next=/admin/series`);
  const roles: string[] = ((user.app_metadata as any)?.roles ?? []) as string[];
  const isAdmin =
    roles.includes("admin") ||
    (user.app_metadata as any)?.role === "admin" ||
    (user.user_metadata as any)?.is_admin === true;
  if (!isAdmin) redirect("/");
  return supabase;
}

export default async function AdminSeriesPage() {
  const supabase = await requireAdmin();

  const { data, error } = await supabase
    .from("series")
    .select("id,name,slug,description,is_active")
    .order("name", { ascending: true });

  // Make TS happy – guarantee an array for the rest of the component
  const rows: SeriesRow[] = (data ?? []) as SeriesRow[];

  if (error) {
    return (
      <div className="space-y-6">
        <div className="card">
          <div className="card-body flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold">Admin — Series</div>
              <div className="text-xs text-neutral-500 dark:text-neutral-300">
                Manage all series
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/admin" className="rounded-md border px-3 py-1.5 text-sm">
                Dashboard
              </Link>
              <Link href="/admin/series/new" className="rounded-md border px-3 py-1.5 text-sm">
                + New Series
              </Link>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body text-sm text-red-600 dark:text-red-400">
            Failed to load series: {error.message}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-body flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">Admin — Series</div>
            <div className="text-xs text-neutral-500 dark:text-neutral-300">
              Manage all series
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin" className="rounded-md border px-3 py-1.5 text-sm">
              Dashboard
            </Link>
            <Link href="/admin/series/new" className="rounded-md border px-3 py-1.5 text-sm">
              + New Series
            </Link>
          </div>
        </div>
      </div>

      <section className="card overflow-x-auto">
        <div className="card-header flex items-center justify-between">
          <span>Series</span>
          <Link href="/admin/series" className="text-sm underline">
            Refresh
          </Link>
        </div>

        {rows.length === 0 ? (
          <div className="card-body text-sm text-neutral-600 dark:text-neutral-300">
            No series yet.
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th className="text-left">Name</th>
                <th className="text-left">Slug</th>
                <th className="text-left">Description</th>
                <th className="text-left">Active</th>
                <th className="text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td className="font-medium">{s.name}</td>
                  <td>{s.slug ?? ""}</td>
                  <td className="text-neutral-600 dark:text-neutral-300">
                    {s.description ?? ""}
                  </td>
                  <td>
                    {s.is_active ? (
                      <span className="badge border-green-300 text-green-700 bg-green-50 dark:border-green-700 dark:text-green-300 dark:bg-green-950">
                        Active
                      </span>
                    ) : (
                      <span className="badge border-neutral-300 text-neutral-700 bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:bg-neutral-900">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="space-x-2 whitespace-nowrap">
                    <Link
                      className="rounded-md border px-2 py-1 text-sm"
                      href={`/admin/series/${s.id}`}
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
