import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isAdminUser } from "@/lib/isAdmin";

// Refreshes the Supabase auth session so logins don't silently expire, and guards admin routes.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Everything under /admin and /api/admin requires an admin, before any route code runs.
  const path = request.nextUrl.pathname;
  if (path.startsWith("/api/admin") && !isAdminUser(user)) {
    return NextResponse.json({ error: user ? "Forbidden" : "Unauthorized" }, { status: user ? 403 : 401 });
  }
  if ((path === "/admin" || path.startsWith("/admin/")) && !isAdminUser(user)) {
    const url = request.nextUrl.clone();
    url.pathname = user ? "/403" : "/login";
    url.search = user ? "" : `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(url);
  }

  return response;
}

// Only where the server reads the login: running on public pages would cost a function call
// per visit, even for pages served from cache. The browser client keeps its own session fresh.
export const config = {
  matcher: ["/admin/:path*", "/api/:path*", "/logout"],
};
