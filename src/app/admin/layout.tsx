import { ReactNode } from "react";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";
import AdminNav from "@/components/admin/AdminNav"; // <--- Import the new component

export const runtime = "nodejs";
export const revalidate = 0;

type Props = { children: ReactNode };

export default async function AdminLayout({ children }: Props) {
  // 1. Secure the Admin Area (Server-Side Auth)
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user;

  if (!user) redirect("/login");

  // Check Admin Role
  const roles = ((user?.app_metadata as any)?.roles ?? []) as string[];
  const isAdmin = roles?.includes("admin") || (user?.user_metadata as any)?.is_admin;

  if (!isAdmin) redirect("/403"); // Or redirect to home

  const email = user.email || "Admin";

  return (
    <div className="flex flex-col min-h-screen bg-base-100 text-base-content">
      
      {/* ADMIN TOOLBAR */}
      <div className="sticky top-16 z-40 w-full border-b border-white/5 bg-base-100/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            
            {/* Left: Smart Navigation */}
            <AdminNav />

            {/* Right: User Identity */}
            <div className="hidden md:flex items-center gap-4 text-xs font-medium text-base-content/50">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isAdmin ? 'bg-success shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-warning'}`}></div>
                <span className="font-mono tracking-tight">{email}</span>
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

      {/* MAIN CONTENT */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}