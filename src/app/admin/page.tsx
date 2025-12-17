import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import AdminTools from "@/components/admin/AdminTools";

export const revalidate = 0; // Always fresh data

export default async function AdminDashboard() {
  const supabase = await createSupabaseServerClient();

  // 1. Fetch Quick Stats
  const [seasonRes, playersRes, eventsRes] = await Promise.all([
    supabase.from("seasons").select("label").eq("is_active", true).maybeSingle(),
    supabase.from("players").select("id", { count: "exact", head: true }),
    supabase.from("events").select("id", { count: "exact", head: true })
  ]);

  const activeLabel = seasonRes.data?.label || "No Active Season";
  const playerCount = playersRes.count || 0;
  const eventCount = eventsRes.count || 0;

  return (
    <div className="container mx-auto max-w-6xl py-12 px-4 space-y-12">
      
      {/* HEADER & KPI */}
      <div className="space-y-6">
        <div>
            <div className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Command Center</div>
            <h1 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter text-white">
            Admin Dashboard
            </h1>
        </div>

        {/* KPI CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="stat bg-base-100 shadow-lg border border-white/5 rounded-xl">
                <div className="stat-title text-xs font-bold uppercase tracking-wider opacity-60">Active Season</div>
                <div className="stat-value text-2xl text-primary">{activeLabel}</div>
            </div>
            <div className="stat bg-base-100 shadow-lg border border-white/5 rounded-xl">
                <div className="stat-title text-xs font-bold uppercase tracking-wider opacity-60">Total Players</div>
                <div className="stat-value text-2xl">{playerCount}</div>
            </div>
            <div className="stat bg-base-100 shadow-lg border border-white/5 rounded-xl">
                <div className="stat-title text-xs font-bold uppercase tracking-wider opacity-60">Events Logged</div>
                <div className="stat-value text-2xl">{eventCount}</div>
            </div>
        </div>
      </div>

      <div className="divider opacity-10">MANAGEMENT</div>

      {/* QUICK ACTIONS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/admin/import" className="group card bg-base-100 shadow-xl border border-white/5 hover:border-primary/50 transition-all hover:-translate-y-1 cursor-pointer">
          <div className="card-body">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-2xl mb-2 group-hover:bg-primary group-hover:text-black transition-colors">
              📥
            </div>
            <h3 className="card-title text-lg font-bold">Import Results</h3>
            <p className="text-xs text-base-content/60">Upload Excel spreadsheets to update rankings.</p>
          </div>
        </Link>

        <Link href="/admin/events" className="group card bg-base-100 shadow-xl border border-white/5 hover:border-primary/50 transition-all hover:-translate-y-1 cursor-pointer">
          <div className="card-body">
            <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center text-2xl mb-2 group-hover:bg-secondary group-hover:text-black transition-colors">
              🗓️
            </div>
            <h3 className="card-title text-lg font-bold">Manage Events</h3>
            <p className="text-xs text-base-content/60">Edit event names, set High Roller status.</p>
          </div>
        </Link>

        <Link href="/admin/seasons" className="group card bg-base-100 shadow-xl border border-white/5 hover:border-primary/50 transition-all hover:-translate-y-1 cursor-pointer">
          <div className="card-body">
            <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center text-2xl mb-2 group-hover:bg-accent group-hover:text-black transition-colors">
              🏆
            </div>
            <h3 className="card-title text-lg font-bold">Manage Seasons</h3>
            <p className="text-xs text-base-content/60">Create new seasons and configure leagues.</p>
          </div>
        </Link>
      </div>

      <div className="divider opacity-10">SYSTEM TOOLS</div>

      {/* TOOLS & MAINTENANCE */}
      <AdminTools />

    </div>
  );
}