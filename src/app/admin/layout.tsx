import { ReactNode } from "react";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { isAdminUser } from "@/lib/isAdmin";
import { redirect } from "next/navigation";
import AdminNav from "@/components/admin/AdminNav";

export const runtime = "nodejs";
export const revalidate = 0;

type Props = { children: ReactNode };

export default async function AdminLayout({ children }: Props) {
  // Server-side gate (proxy.ts also guards /admin).
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user;

  if (!user) redirect("/login");
  if (!isAdminUser(user)) redirect("/403");

  const email = user.email || "Admin";

  return (
    <div className="flex min-h-screen flex-col">
      {/* Admin toolbar, under the site header */}
      <div className="sticky top-20 z-40 w-full border-b border-base-content/[0.07] bg-base-200/85 backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <span className="hidden shrink-0 rounded-md bg-primary/12 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary ring-1 ring-inset ring-primary/25 sm:inline">
              Admin
            </span>
            <AdminNav />
          </div>

          <div className="hidden shrink-0 items-center gap-4 text-xs text-base-content/50 md:flex">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
              <span className="font-mono">{email}</span>
            </span>
          </div>
        </div>
      </div>

      <main className="flex-1">{children}</main>
    </div>
  );
}
