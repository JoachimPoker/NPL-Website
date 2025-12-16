import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import SnapshotButton from "@/components/SnapshotButton";

export const runtime = "nodejs";
export const revalidate = 0;

type Season = {
  id: number;
  label: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
};

function fmtUk(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-GB", { day: 'numeric', month: 'short', year: '2-digit' });
}

export default async function AdminHome() {
  const supabase = await createSupabaseServerClient();

  // ---- Auth gate ----
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) redirect(`/login?next=/admin`);
  const roles: string[] = ((user.app_metadata as any)?.roles as string[]) || [];
  const isAdmin =
    roles.includes("admin") ||
    (user.app_metadata as any)?.role === "admin" ||
    (user.user_metadata as any)?.is_admin === true;
  if (!isAdmin) redirect("/");

  // ---- Parallel small queries for the dashboard ----
  const [
    playersCountRes,
    eventsCountRes,
    resultsCountRes,
    seasonsRes,
    lastBatchRes,
    lastChangesRes,
  ] = await Promise.all([
    supabase.from("players").select("*", { count: "exact", head: true }),
    supabase.from("events").select("*", { count: "exact", head: true }),
    supabase.from("results").select("*", { count: "exact", head: true }).eq("is_deleted", false),
    supabase
      .from("seasons")
      .select("*")
      .order("is_active", { ascending: false })
      .order("start_date", { ascending: false }),
    supabase
      .from("import_batches")
      .select("id, filename, imported_by, imported_at")
      .order("imported_at", { ascending: false })
      .limit(5),
    supabase
      .from("result_changes")
      .select("id, change_type, changed_at")
      .order("changed_at", { ascending: false })
      .limit(5),
  ]);

  const playersCount = playersCountRes.count ?? 0;
  const eventsCount = eventsCountRes.count ?? 0;
  const resultsCount = resultsCountRes.count ?? 0;
  const activeSeason: Season | undefined = seasonsRes.data?.find((s) => s.is_active);
  const lastBatches = lastBatchRes.data ?? [];
  const lastChanges = lastChangesRes.data ?? [];

  return (
    <div className="container mx-auto max-w-7xl space-y-8 py-8 px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter text-white">
            Admin Dashboard
          </h1>
          <p className="text-base-content/60 mt-1 font-medium">
            System Overview & Management
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/" className="btn btn-ghost btn-sm uppercase font-bold">
            View Live Site
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Players" value={playersCount.toLocaleString("en-GB")} href="/admin/players" />
        <KpiCard label="Events Tracked" value={eventsCount.toLocaleString("en-GB")} href="/admin/series" />
        <KpiCard label="Results Logged" value={resultsCount.toLocaleString("en-GB")} href="/leaderboards" />
        <KpiCard
          label="Active Season"
          value={activeSeason ? activeSeason.label : "None"}
          hint={activeSeason ? `${fmtUk(activeSeason.start_date)} → ${fmtUk(activeSeason.end_date)}` : "No active season"}
          href="/admin/seasons"
          isHighlight
        />
      </section>

      {/* Quick Actions */}
      <section className="card bg-base-100 shadow-xl border border-white/5">
        <div className="card-body p-6">
          <h3 className="text-sm font-bold uppercase tracking-widest text-base-content/40 mb-4">Quick Actions</h3>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/import-excel" className="btn btn-primary btn-sm uppercase font-bold">
              📥 Import Excel
            </Link>
            <Link href="/admin/series" className="btn btn-outline btn-sm uppercase font-bold">
              📅 Manage Series
            </Link>
            <Link href="/admin/players" className="btn btn-outline btn-sm uppercase font-bold">
              👥 Edit Players
            </Link>
            <SnapshotButton />
          </div>
        </div>
      </section>

      {/* Recent Activity Grid */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Recent Imports */}
        <div className="card bg-base-100 shadow-xl border border-white/5 overflow-hidden">
          <div className="card-header p-4 border-b border-white/5 flex justify-between items-center bg-base-200/20">
            <span className="text-sm font-bold uppercase tracking-widest">Recent Imports</span>
            <Link href="/admin/import-excel" className="text-xs font-bold text-primary uppercase hover:underline">
              View All
            </Link>
          </div>
          <div className="p-0 overflow-x-auto">
            {lastBatches.length === 0 ? (
              <div className="p-6 text-sm text-base-content/50 italic text-center">No imports yet.</div>
            ) : (
              <table className="table table-sm w-full">
                <thead>
                  <tr className="text-xs uppercase text-base-content/50 bg-base-200/30">
                    <th>Date</th>
                    <th>File</th>
                  </tr>
                </thead>
                <tbody>
                  {lastBatches.map((b: any) => (
                    <tr key={b.id} className="border-b border-white/5 last:border-0">
                      <td className="font-mono text-xs opacity-70">{fmtUk(b.imported_at)}</td>
                      <td className="font-bold text-sm truncate max-w-[200px]" title={b.filename}>
                        {b.filename}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Recent Changes */}
        <div className="card bg-base-100 shadow-xl border border-white/5 overflow-hidden">
          <div className="card-header p-4 border-b border-white/5 bg-base-200/20">
            <span className="text-sm font-bold uppercase tracking-widest">Audit Log</span>
          </div>
          <div className="p-0 overflow-x-auto">
            {lastChanges.length === 0 ? (
              <div className="p-6 text-sm text-base-content/50 italic text-center">No changes recorded.</div>
            ) : (
              <table className="table table-sm w-full">
                <thead>
                  <tr className="text-xs uppercase text-base-content/50 bg-base-200/30">
                    <th>Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {lastChanges.map((c: any) => (
                    <tr key={c.id} className="border-b border-white/5 last:border-0">
                      <td className="font-mono text-xs opacity-70">{fmtUk(c.changed_at)}</td>
                      <td className="uppercase text-xs font-bold tracking-wide">
                        <span className="badge badge-ghost badge-sm">{c.change_type}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  href,
  isHighlight
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  isHighlight?: boolean;
}) {
  const content = (
    <div className={`card shadow-lg border p-5 transition-all hover:-translate-y-1 hover:shadow-2xl group ${
      isHighlight ? 'bg-primary/10 border-primary/30' : 'bg-base-100 border-white/5 hover:border-primary/30'
    }`}>
      <div className={`text-xs font-bold uppercase tracking-widest mb-1 ${
        isHighlight ? 'text-primary' : 'text-base-content/40 group-hover:text-primary transition-colors'
      }`}>{label}</div>
      <div className="text-3xl font-black text-white">{value}</div>
      {hint && <div className="mt-2 text-xs font-mono text-base-content/50">{hint}</div>}
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}