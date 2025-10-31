// src/app/admin/page.tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

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
  return dt.toLocaleDateString("en-GB");
}

export default async function AdminHome() {
  const supabase = await createSupabaseServerClient();

  // ---- Auth gate (middleware also guards /admin) ----
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
    <div className="space-y-6">
      {/* KPI cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Players" value={playersCount.toLocaleString("en-GB")} href="/admin/players" />
        <KpiCard label="Events" value={eventsCount.toLocaleString("en-GB")} href="/admin/series" />
        <KpiCard label="Results (active)" value={resultsCount.toLocaleString("en-GB")} href="/leaderboards" />
        <KpiCard
          label="Active season"
          value={activeSeason ? activeSeason.label : "None"}
          hint={
            activeSeason
              ? `${fmtUk(activeSeason.start_date)} → ${fmtUk(activeSeason.end_date)}`
              : "No active season"
          }
          href="/admin/seasons"
        />
      </section>

      {/* Recent activity */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Recent imports */}
        <div className="card overflow-hidden">
          <div className="card-header flex items-center justify-between">
            <span>Recent Imports</span>
            <Link href="/admin/import" className="text-sm underline">
              Open import
            </Link>
          </div>
          <div className="card-body p-0">
            {lastBatches.length === 0 ? (
              <div className="p-4 text-sm text-neutral-600 dark:text-neutral-300">No imports yet.</div>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="text-left">When</th>
                    <th className="text-left">File</th>
                    <th className="text-left">By</th>
                  </tr>
                </thead>
                <tbody>
                  {lastBatches.map((b: any) => (
                    <tr key={b.id}>
                      <td>{fmtUk(b.imported_at)}</td>
                      <td className="truncate max-w-[260px]" title={b.filename}>
                        {b.filename}
                      </td>
                      <td>{b.imported_by ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Recent result changes */}
        <div className="card overflow-hidden">
          <div className="card-header">Recent Result Changes</div>
          <div className="card-body p-0">
            {lastChanges.length === 0 ? (
              <div className="p-4 text-sm text-neutral-600 dark:text-neutral-300">No changes yet.</div>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="text-left">When</th>
                    <th className="text-left">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {lastChanges.map((c: any) => (
                    <tr key={c.id}>
                      <td>{fmtUk(c.changed_at)}</td>
                      <td className="uppercase text-xs tracking-wide">{c.change_type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>

      {/* Quick actions */}
      <section className="card">
        <div className="card-body flex flex-wrap items-center gap-3">
          <Link href="/admin/seasons" className="rounded-md border px-3 py-2 text-sm">
            Manage seasons
          </Link>
          <Link href="/admin/import-excel" className="rounded-md border px-3 py-2 text-sm">
            Import weekly Excel
          </Link>
          <Link href="/admin/series" className="rounded-md border px-3 py-2 text-sm">
            Assign series / festivals
          </Link>
          <Link href="/admin/players" className="rounded-md border px-3 py-2 text-sm">
            Edit players
          </Link>
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
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
}) {
  const content = (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {hint ? <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-300">{hint}</div> : null}
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}
