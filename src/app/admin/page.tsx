import Link from "next/link";
import {
  ArrowRight, Award, Image as ImageIcon, Mail, UserCog, CalendarClock, CalendarDays, FileUp, Layers, Medal, Newspaper, Tent, Trophy, Users,
  type LucideIcon,
} from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import AdminTools from "@/components/admin/AdminTools";
import RuledHeading from "@/components/RuledHeading";
import { LEGAL_MISSING } from "@/lib/legal";

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
  { href: "/admin/images", title: "Site photos", text: "Replace the photos on the home page, section headers and thumbnails.", icon: ImageIcon },
  { href: "/admin/messages", title: "Messages", text: "From the contact form: name removals, corrections and questions.", icon: Mail },
  { href: "/admin/users", title: "Users", text: "Admin accounts: who can sign in and manage the site.", icon: UserCog },
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
  // Contact messages waiting (0 until the contact_messages migration has run).
  const { count: openMessages } = await supabase.from("contact_messages" as any).select("id", { count: "exact", head: true }).is("handled_at", null);
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
    <div className="space-y-[clamp(2rem,3.5vw,3rem)] px-4 py-[clamp(1.75rem,3vw,2.75rem)] sm:px-[3.6vw]">
      <div>
        <h1 className="text-[clamp(2rem,3.2vw,3rem)] font-bold leading-[1.04] tracking-[-0.012em]">Dashboard</h1>
        <p className="mt-2 text-[1.0625rem] text-season-muted">Run the weekly import, then keep the records tidy.</p>
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden border border-white/[0.08] bg-white/[0.08] lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col-reverse bg-season-night px-5 py-4">
            <dt className="text-[0.9375rem] text-season-muted">{s.label}</dt>
            <dd className={`text-[clamp(1.25rem,2.2vw,2rem)] font-bold leading-tight tabular-nums ${s.accent ? "text-season-amber" : ""}`}>{s.value}</dd>
          </div>
        ))}
      </dl>

      {/* Things that need attention: unanswered messages, and the legal details still to fill in before launch. */}
      {((openMessages ?? 0) > 0 || LEGAL_MISSING.length > 0) && (
        <div className="space-y-2">
          {(openMessages ?? 0) > 0 && (
            <Link href="/admin/messages" className="flex items-center gap-3 rounded-[3px] border border-season-amber/50 bg-season-amber/[0.06] px-4 py-3 text-[0.9375rem] hover:border-season-amber">
              <Mail size={18} className="shrink-0 text-season-amber" aria-hidden="true" />
              <span><span className="font-semibold">{openMessages} {openMessages === 1 ? "message" : "messages"}</span> waiting for a reply.</span>
            </Link>
          )}
          {LEGAL_MISSING.length > 0 && (
            <p className="rounded-[3px] border border-white/[0.14] px-4 py-3 text-[0.9375rem] text-season-ink/85">
              Before launch, add {LEGAL_MISSING.join(", ")} in <code>src/lib/legal.ts</code>. They appear on the privacy, terms and contact pages.
            </p>
          )}
        </div>
      )}

      {/* The weekly job, given its own place */}
      <Link
        href="/admin/import"
        className="group flex flex-col gap-4 border border-season-amber/60 bg-[linear-gradient(180deg,#14434a_0%,#0f3337_60%)] p-5 transition-colors hover:border-season-amber sm:flex-row sm:items-center sm:justify-between sm:p-6"
      >
        <span className="flex items-center gap-4">
          <FileUp size={28} strokeWidth={1.75} className="shrink-0 text-season-amber" aria-hidden="true" />
          <span>
            <span className="block text-[1.25rem] font-semibold">Import this week&apos;s results</span>
            <span className="block text-[0.9375rem] text-season-ink/75">Upload the RawPlayerData report. You see a preview before anything changes.</span>
          </span>
        </span>
        <span className="inline-flex h-11 shrink-0 items-center gap-2 self-start rounded-[3px] bg-season-amber px-4 font-semibold text-season-amber-ink sm:self-auto">
          Start import <ArrowRight size={17} strokeWidth={2.25} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>

      <section aria-labelledby="admin-sections">
        <RuledHeading id="admin-sections">Manage</RuledHeading>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {SECTIONS.filter((s) => s.href !== "/admin/import").map(({ href, title, text, icon: Icon }) => (
            <li key={href}>
              <Link href={href} className="group flex h-full items-start gap-4 border border-white/[0.08] bg-[linear-gradient(180deg,#0f3337_0%,#0a2427_100%)] p-4 transition-colors hover:border-white/25">
                <Icon size={20} strokeWidth={1.75} className="mt-0.5 shrink-0 text-season-amber" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2 text-[1.0625rem] font-semibold">
                    {title}
                    <ArrowRight size={15} className="shrink-0 text-season-muted transition-transform group-hover:translate-x-0.5 group-hover:text-season-ink" aria-hidden="true" />
                  </span>
                  <span className="mt-0.5 block text-[0.9375rem] leading-snug text-season-ink/70">{text}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="admin-tools">
        <RuledHeading id="admin-tools">System tools</RuledHeading>
        <div className="mt-4">
          <AdminTools />
        </div>
      </section>
    </div>
  );
}
