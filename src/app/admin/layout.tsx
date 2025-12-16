import { ReactNode } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const revalidate = 0;

type Props = { children: ReactNode };

// Helper to check active state
function isOn(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname.startsWith(href);
}

export default async function AdminLayout({ children }: Props) {
  // 1. Get Path (Next.js 15 compatible)
  const h = await headers();
  const pathname = h.get("x-invoke-path") || "/admin";

  // 2. Get User
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  const email = user?.email || "Admin";
  const roles = ((user?.app_metadata as any)?.roles ?? []) as string[];
  const isAdmin = roles?.includes("admin") || (user?.user_metadata as any)?.is_admin;

  // 3. Navigation Links
  const links = [
    { label: "Dashboard", href: "/admin" },
    { label: "Seasons", href: "/admin/seasons" },
    { label: "Series", href: "/admin/series" },
    { label: "Events", href: "/admin/events" },
    { label: "Players", href: "/admin/players" },
    { label: "Import", href: "/admin/import-excel" },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* ADMIN TOOLBAR 
        A sleek sub-header that sits below the main site header.
        Uses glass morphism (backdrop-blur) and subtle borders.
      */}
      <div className="sticky top-16 z-40 w-full border-b border-white/5 bg-base-100/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            
            {/* Left: Navigation Tabs */}
            <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {links.map((link) => {
                const active = isOn(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`btn btn-sm text-xs font-bold uppercase tracking-wider transition-all ${
                      active
                        ? "btn-primary text-primary-content"
                        : "btn-ghost text-base-content/60 hover:text-white"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            {/* Right: User Identity */}
            <div className="hidden md:flex items-center gap-4 text-xs font-medium text-base-content/50">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isAdmin ? 'bg-success' : 'bg-warning'}`}></div>
                <span>{email}</span>
              </div>
              <div className="h-4 w-px bg-white/10"></div>
              <form action="/auth/signout" method="post">
                <button className="hover:text-white transition-colors uppercase font-bold tracking-wide">
                  Sign Out
                </button>
              </form>
            </div>

          </div>
        </div>
      </div>

      {/* MAIN CONTENT 
        We remove the strict spacing here so the pages (Dashboard, Players)
        can define their own full-width or contained layouts.
      */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}