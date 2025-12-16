import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const revalidate = 0;

export default async function AdminSeasonsListPage() {
  const supabase = await createSupabaseServerClient();

  // 1. Auth Check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 2. Fetch Seasons
  const { data: seasons, error } = await supabase
    .from("seasons")
    .select("*")
    .order("start_date", { ascending: false });

  if (error) {
    console.error("Error fetching seasons:", error);
  }

  return (
    <div className="container mx-auto max-w-5xl space-y-8 py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-6">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-primary mb-1">Admin</div>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter text-white">
            Manage Seasons
          </h1>
        </div>
        <div className="flex gap-2">
            <Link href="/admin" className="btn btn-ghost btn-sm uppercase font-bold">
              ← Dashboard
            </Link>
            <Link href="/admin/seasons/create" className="btn btn-primary btn-sm uppercase font-bold">
              + New Season
            </Link>
        </div>
      </div>

      {/* Seasons List */}
      <div className="card bg-base-100 shadow-xl border border-white/5 overflow-hidden">
        <div className="p-0 overflow-x-auto">
          <table className="table table-lg w-full">
            <thead>
              <tr className="bg-base-200/50 text-xs uppercase text-base-content/60 border-b border-white/5">
                <th className="w-16">Status</th>
                <th>Season Name</th>
                <th>Dates</th>
                <th>Scoring Rules</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {!seasons?.length ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-base-content/50 italic">
                    No seasons found. Create your first season to get started.
                  </td>
                </tr>
              ) : (
                seasons.map((s) => (
                  <tr key={s.id} className="hover:bg-base-200/30 transition-colors border-b border-white/5 last:border-0">
                    <td>
                        {s.is_active ? (
                            <div className="badge badge-success badge-sm font-bold animate-pulse">ACTIVE</div>
                        ) : (
                            <div className="badge badge-ghost badge-sm opacity-50">PAST</div>
                        )}
                    </td>
                    <td>
                      <div className="font-bold text-white text-lg">{s.label}</div>
                    </td>
                    <td className="font-mono text-xs opacity-70">
                        {new Date(s.start_date).toLocaleDateString()} → {new Date(s.end_date).toLocaleDateString()}
                    </td>
                    <td>
                        <div className="flex flex-col text-xs">
                            <span className="font-bold uppercase tracking-wide opacity-80">
                                {s.scoring_method === 'capped' ? 'Capped Score' : 'Total Accumulator'}
                            </span>
                            {s.scoring_method === 'capped' && (
                                <span className="opacity-50">Best {s.scoring_cap} results count</span>
                            )}
                        </div>
                    </td>
                    <td className="text-right">
                      <Link 
                        href={`/admin/seasons/${s.id}`} 
                        className="btn btn-sm btn-outline uppercase font-bold"
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
      </div>
    </div>
  );
}