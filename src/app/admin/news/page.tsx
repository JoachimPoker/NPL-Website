import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export default async function AdminNewsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: articles, error } = await supabase
    .from("news")
    .select("id, title, category, published_at, is_published, is_featured")
    .order("published_at", { ascending: false });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      <div className="flex flex-col gap-4 border-b border-base-content/[0.07] pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">News</h1>
          <p className="text-sm text-base-content/60">Announcements and tournament reports shown on the News page.</p>
        </div>
        <Link href="/admin/news/new" className="btn btn-primary btn-sm">+ New article</Link>
      </div>

      {error && <div role="alert" className="alert alert-error text-sm">{error.message}</div>}

      <div className="panel overflow-hidden">
        <table className="table table-sm w-full">
          <thead className="bg-base-200/50 text-[0.8125rem]">
            <tr>
              <th>Title</th>
              <th className="hidden sm:table-cell">Category</th>
              <th>Date</th>
              <th className="text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {(articles || []).map((a) => (
              <tr key={a.id} className="hover:bg-base-200/30">
                <td>
                  <Link href={`/admin/news/${a.id}`} className="font-bold hover:text-primary">{a.title}</Link>
                  {a.is_featured && <span className="badge badge-primary badge-xs ml-2">Featured</span>}
                </td>
                <td className="hidden text-xs opacity-70 sm:table-cell">{a.category ?? "—"}</td>
                <td className="font-mono text-xs opacity-60">
                  {a.published_at ? new Date(a.published_at).toLocaleDateString("en-GB") : "—"}
                </td>
                <td className="text-center">
                  {a.is_published
                    ? <span className="badge badge-success badge-xs">Published</span>
                    : <span className="badge badge-ghost badge-xs">Draft</span>}
                </td>
              </tr>
            ))}
            {!articles?.length && (
              <tr><td colSpan={4} className="py-10 text-center text-sm opacity-50">No articles yet. Write the first one.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
