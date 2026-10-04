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
    <div className="flex min-h-screen flex-col bg-season-night font-season text-season-ink">
      {/* Admin toolbar, under the site header */}
      <div className="sticky top-[5.75rem] z-40 w-full border-b border-white/[0.08] bg-[#041214]/95 backdrop-blur-md">
        <div className="flex h-12 items-center justify-between gap-6 px-4 sm:px-[3.6vw]">
          <div className="flex min-w-0 items-center gap-4">
            <span className="hidden shrink-0 rounded-[3px] px-2 py-0.5 text-[0.8125rem] font-semibold text-season-amber shadow-[inset_0_0_0_1px_rgb(242_163_58/0.6)] sm:inline">
              Admin
            </span>
            <AdminNav />
          </div>

          <div className="hidden shrink-0 items-center gap-2 text-[0.875rem] text-season-muted md:flex">
            <span className="size-2 rounded-full bg-season-up" aria-hidden="true" />
            <span>{email}</span>
            <span aria-hidden="true">·</span>
            <form action="/logout" method="post">
              <button type="submit" className="underline decoration-season-muted/40 underline-offset-4 hover:text-season-ink">Sign out</button>
            </form>
          </div>
        </div>
      </div>

      <main className="flex-1">{children}</main>
    </div>
  );
}
