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
  events: { count: number }[]; // Relation count
};

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) redirect(`/login?next=/admin/series`);
  
  // Basic Admin Check
  const roles: string[] = ((user.app_metadata as any)?.roles ?? []) as string[];
  const isAdmin = roles.includes("admin") || (user.user_metadata as any)?.is_admin === true;
  
  if (!isAdmin) redirect("/");
  return supabase;
}

export default async function AdminSeriesPage(props: { searchParams: Promise<{ q?: string }> }) {
  const searchParams = await props.searchParams;
  const supabase = await requireAdmin();
  const query = searchParams.q?.toLowerCase() || "";

  // Fetch Series + Event Count
  const { data, error } = await supabase
    .from("series")
    .select("*, events(count)")
    .order("name", { ascending: true });

  if (error) return <div className="alert alert-error">Error: {error.message}</div>;

  const rows = (data as any[]).filter((s) => 
    !query || s.name.toLowerCase().includes(query) || s.slug?.toLowerCase().includes(query)
  );

  return (
    <div className="container mx-auto max-w-7xl py-8 px-4 space-y-8">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-white/5 pb-6">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-primary mb-1">Admin Dashboard</div>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter text-white">
            Series Manager
          </h1>
        </div>
        <div className="flex gap-3">
            {/* Search Input (Server Side via Form for simplicity, or could be client) */}
            <form className="join">
                <input 
                    name="q" 
                    defaultValue={query} 
                    className="input input-sm input-bordered join-item w-48" 
                    placeholder="Search series..." 
                />
                <button type="submit" className="btn btn-sm btn-ghost border-base-content/20 join-item">🔍</button>
            </form>
            <Link href="/admin/series/new" className="btn btn-primary btn-sm uppercase font-bold tracking-widest shadow-lg shadow-primary/20">
            + New Series
            </Link>
        </div>
      </div>

      {/* EMPTY STATE */}
      {rows.length === 0 && (
        <div className="text-center py-12 opacity-50">
            <div className="text-4xl mb-2">📭</div>
            <p>No series found matching your search.</p>
            {query && <Link href="/admin/series" className="btn btn-link">Clear Search</Link>}
        </div>
      )}

      {/* SERIES GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rows.map((s) => (
          <Link 
            key={s.id} 
            href={`/admin/series/${s.id}`}
            className="group card bg-base-100 shadow-xl border border-white/5 hover:border-primary/50 hover:-translate-y-1 transition-all duration-300"
          >
            <div className="card-body p-6">
              
              <div className="flex justify-between items-start mb-2">
                <div className="badge badge-xs font-mono opacity-50 uppercase tracking-wider">
                    ID: {s.id}
                </div>
                {s.is_active ? (
                    <span className="w-2 h-2 rounded-full bg-success shadow-[0_0_10px_rgba(34,197,94,0.5)]"></span>
                ) : (
                    <span className="w-2 h-2 rounded-full bg-base-content/20"></span>
                )}
              </div>

              <h3 className="card-title text-2xl font-bold group-hover:text-primary transition-colors">
                {s.name}
              </h3>
              
              <div className="font-mono text-xs opacity-50 mb-4 truncate">
                slug: <span className="text-secondary">{s.slug || "—"}</span>
              </div>

              <p className="text-sm text-base-content/70 line-clamp-2 min-h-[2.5em] mb-4">
                {s.description || "No description provided."}
              </p>

              <div className="flex items-center justify-between pt-4 border-t border-white/5">
                <div className="flex gap-2">
                    <div className="badge badge-neutral text-xs font-bold">
                        {s.events?.[0]?.count ?? 0} Events
                    </div>
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    Manage →
                </span>
              </div>

            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}