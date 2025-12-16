import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const revalidate = 0;

export default async function AdminSeriesPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: series } = await supabase
    .from("series")
    .select("*, events(count)")
    .order("name", { ascending: true });

  return (
    <div className="container mx-auto max-w-7xl space-y-8 py-8 px-4">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-white/5 pb-6">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-primary mb-1">Admin</div>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter text-white">
            Tournament Series
          </h1>
        </div>
        <Link href="/admin/series/create" className="btn btn-primary btn-sm uppercase font-bold">
          + New Series
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {series?.map((s) => (
          <Link 
            key={s.id} 
            href={`/admin/series/${s.id}`}
            className="card bg-base-100 shadow-xl border border-white/5 hover:border-primary/50 hover:-translate-y-1 transition-all group"
          >
            <div className="card-body">
              <div className="flex justify-between items-start">
                <h3 className="card-title text-xl font-bold group-hover:text-primary transition-colors">
                  {s.name}
                </h3>
                <span className="badge badge-ghost font-mono text-xs">{s.events?.[0]?.count ?? 0} Events</span>
              </div>
              <p className="text-sm text-base-content/60 line-clamp-2 min-h-[2.5em]">
                {s.description || "No description provided."}
              </p>
              <div className="card-actions justify-end mt-4">
                <span className="btn btn-xs btn-ghost uppercase font-bold">Manage →</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}