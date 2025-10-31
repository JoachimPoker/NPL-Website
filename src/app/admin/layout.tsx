// src/app/admin/layout.tsx
import { ReactNode } from "react";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const revalidate = 0;

type Props = { children: ReactNode };

// Map pathname → human title
function titleFor(path: string) {
  // normalize to just the /admin/* part
  const p = path || "/admin";
  if (p === "/admin") return "Dashboard";
  if (p.startsWith("/admin/seasons")) return "Seasons";
  if (p.startsWith("/admin/import")) return "Import";
  if (p.startsWith("/admin/series")) return "Series";
  if (p.startsWith("/admin/players")) return "Players";
  return "Admin";
}

function isOn(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export default async function AdminLayout({ children }: Props) {
  // figure out current path (works in dev/prod)
  const h = await headers();
  const pathname =
    h.get("next-url") ||
    h.get("x-invoke-path") ||
    h.get("x-matched-path") ||
    "/admin";

  // get current user to show email + admin tag
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  const email =
    (user?.email as string | undefined) ||
    (user?.user_metadata as any)?.email ||
    "Admin";
  const roles = ((user?.app_metadata as any)?.roles ?? []) as string[];
  const isAdmin = roles?.includes("admin") || (user?.user_metadata as any)?.is_admin;

  const pageTitle = titleFor(pathname);

  const Link = ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a
      href={href}
      className={`rounded-md border px-3 py-1.5 text-sm ${
        isOn(pathname, href)
          ? "font-semibold bg-neutral-100 dark:bg-neutral-800"
          : ""
      }`}
    >
      {children}
    </a>
  );

  return (
    <div className="space-y-6">
      {/* Top admin card shown on every /admin/* page */}
      <section className="card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1>Admin — {pageTitle}</h1>
            <div className="text-sm text-neutral-600 dark:text-neutral-300">
              Signed in as <span className="font-medium">{email}</span>
              {isAdmin ? " · Admin" : ""}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/admin/seasons">Seasons</Link>
            <Link href="/admin/import-excel">Import</Link>
            <Link href="/admin/series">Series</Link>
            <Link href="/admin/players">Players</Link>
          </div>
        </div>

        <div className="mt-3">
          <a
            href="/auth/signout"
            className="text-sm underline text-neutral-600 dark:text-neutral-300"
          >
            Sign out
          </a>
        </div>
      </section>

      {/* Page content */}
      {children}
    </div>
  );
}
