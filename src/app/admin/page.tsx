import Link from "next/link";
import {
  ArrowRight, Award, CalendarClock, CalendarDays, FileUp, Layers, Medal, Newspaper, Tent, Trophy, Users,
  type LucideIcon,
} from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import AdminTools from "@/components/admin/AdminTools";

export const revalidate = 0; // Always fresh data

const SECTIONS: { href: string; title: string; text: string; icon: LucideIcon }[] = [
  { href: "/admin/import", title: "Import results", text: "Upload the weekly report. Preview first, then apply.", icon: FileUp },
  { href: "/admin/seasons", title: "Seasons & prizes", text: "Season dates, league rules and prize money.", icon: Trophy },
  { href: "/admin/leagues", title: "League logos", text: "Logos for the NPL, High Roller and Low Roller leagues.", icon: Medal },
  { href: "/admin/series", title: "Series", text: "Detection patterns and logos.", icon: Layers },
  { href: "/admin/festivals", title: "Festivals", text: "Create festivals, set their dates and pick their events.", icon: Tent },
  { href: "/admin/events", title: "Events", text: "Correct names, dates, buy-ins and High Roller status.", icon: CalendarDays },
  { href: "/admin/players", title: "Players", text: "Profiles, aliases and consent.", icon: Users },
  { href: "/admin/schedule", title: "Schedule", text: "Upcoming dates for the “Coming up” sections.", icon: CalendarClock },
  { href: "/admin/badges", title: "Badges", text: "Badge rules, manual awards and recalculation.", icon: Award },
  { href: "/admin/news", title: "News", text: "Articles and announcements.", icon: Newspaper },
];

export default async function AdminDashboard() {
  const supabase = await createSupabaseServerClient();

  const [seasonRes, playersRes, eventsRes, batchRes] = await Promise.all([
    supabase.from("seasons").select("label:name").eq("is_active", true).maybeSingle(),
    supabase.from("players").select("id", { count: "exact", head: true }),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("is_deleted", false),
    supabase.from("import_batches").select("created_at, snapshot_date").eq("status", "completed").order("created_at", { ascending: false }).limit(1),
  ]);

  const lastImport = batchRes.data?.[0];
  const stats = [
    { label: "Active season", value: seasonRes.data?.label || "None", accent: true },
    { label: "Players", value: (playersRes.count || 0).toLocaleString("en-GB") },
    { label: "Events", value: (eventsRes.count || 0).toLocaleString("en-GB") },
    {
      label: "Last import",
      value: lastImport && (lastImport.snapshot_date ?? lastImport.created_at)
        ? new Date((lastImport.snapshot_date ?? lastImport.created_at)!).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
        : "Never",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-12 px-4 py-10 sm:px-6 lg:px-8">
      <div className="space-y-6">
        <div>
          <div className="eyebrow mb-2 text-primary">Admin</div>
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Dashboard</h1>
        </div>
        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="panel px-5 py-4">
              <dt className="eyebrow">{s.label}</dt>
              <dd className={`mt-1 truncate font-display text-2xl font-semibold tracking-tight ${s.accent ? "text-primary" : ""}`}>{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <section aria-labelledby="admin-sections">
        <h2 id="admin-sections" className="mb-4 font-display text-xl font-semibold tracking-tight">Manage</h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SECTIONS.map(({ href, title, text, icon: Icon }) => (
            <li key={href}>
              <Link href={href} className="panel group flex h-full items-start gap-4 p-5 transition-colors hover:border-primary/40">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-primary/12 text-primary ring-1 ring-inset ring-primary/20">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2 font-display font-semibold transition-colors group-hover:text-primary">
                    {title}
                    <ArrowRight size={15} className="shrink-0 text-base-content/30 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
                  </span>
                  <span className="mt-1 block text-sm text-base-content/55">{text}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="admin-tools">
        <h2 id="admin-tools" className="mb-4 font-display text-xl font-semibold tracking-tight">System tools</h2>
        <AdminTools />
      </section>
    </div>
  );
}
