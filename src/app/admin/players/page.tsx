import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const revalidate = 0;

export default async function AdminPlayersPage(props: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await props.searchParams;
  const supabase = await createSupabaseServerClient();

  // 1. Auth Check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 2. Query
  const q = (sp.q || "").trim();
  const page = Number(sp.page || 1);
  const pageSize = 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // FIX: Removed 'email' from this select string to fix the type error
  let query = supabase
    .from("players")
    .select("id, forename, surname, display_name, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (q) {
    query = query.or(`forename.ilike.%${q}%,surname.ilike.%${q}%,display_name.ilike.%${q}%`);
  }

  const { data: players, count } = await query;
  const total = count || 0;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="container mx-auto max-w-7xl space-y-8 py-8 px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-white/5 pb-6">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-primary mb-1">Admin</div>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter text-white">
            Manage Players
          </h1>
        </div>
        <Link href="/admin" className="btn btn-ghost btn-sm uppercase font-bold">
          ← Back to Dashboard
        </Link>
      </div>

      {/* Search Bar */}
      <div className="card bg-base-100 shadow-lg border border-white/5 p-4">
        <form className="flex gap-2">
          <input 
            name="q" 
            defaultValue={q} 
            placeholder="Search by name..." 
            className="input input-bordered input-sm w-full max-w-md bg-base-200/50 focus:bg-base-200" 
          />
          <button className="btn btn-primary btn-sm uppercase font-bold">Search</button>
          {q && <Link href="/admin/players" className="btn btn-ghost btn-sm uppercase">Clear</Link>}
        </form>
      </div>

      {/* Table Card */}
      <div className="card bg-base-100 shadow-xl border border-white/5 overflow-hidden">
        <div className="p-0 overflow-x-auto">
          <table className="table table-lg w-full">
            <thead>
              <tr className="bg-base-200/50 text-xs uppercase text-base-content/60 border-b border-white/5">
                <th>Name / Display Name</th>
                {/* REMOVED: Contact/Email Column Header */}
                <th className="hidden md:table-cell">Joined</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!players?.length ? (
                <tr>
                  <td colSpan={3} className="text-center py-8 text-base-content/50 italic">
                    No players found.
                  </td>
                </tr>
              ) : (
                players.map((p) => (
                  <tr key={p.id} className="hover:bg-base-200/30 transition-colors border-b border-white/5 last:border-0">
                    <td>
                      <div className="font-bold text-white">
                        {p.forename} {p.surname}
                      </div>
                      {p.display_name && (
                        <div className="text-xs text-primary font-mono mt-0.5">
                          aka {p.display_name}
                        </div>
                      )}
                    </td>
                    {/* REMOVED: Email Cell */}
                    <td className="hidden md:table-cell font-mono text-xs opacity-50">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td className="text-right">
                      <Link 
                        href={`/admin/players/${p.id}`} 
                        className="btn btn-xs btn-outline uppercase font-bold"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="card-footer bg-base-200/20 p-4 border-t border-white/5 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-widest text-base-content/40">
            {total} Records
          </span>
          <div className="join">
            <Link 
              href={`?q=${q}&page=${page - 1}`} 
              className={`join-item btn btn-xs btn-outline ${page <= 1 ? "btn-disabled" : ""}`}
            >
              «
            </Link>
            <button className="join-item btn btn-xs btn-ghost no-animation">
              Page {page}
            </button>
            <Link 
              href={`?q=${q}&page=${page + 1}`} 
              className={`join-item btn btn-xs btn-outline ${page >= totalPages ? "btn-disabled" : ""}`}
            >
              »
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}