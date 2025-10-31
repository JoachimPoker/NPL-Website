// src/lib/adminAuth.ts
import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createSupabaseRouteClient } from "@/lib/supabaseServer"

export type AdminUser = {
  id: string
  email?: string
  app_metadata?: Record<string, any>
  user_metadata?: Record<string, any>
}

export type AdminContext = {
  supabase: SupabaseClient<any, "public", any>
  user: AdminUser
}

export type AdminGate =
  | { ok: true; user: AdminUser; supabase: SupabaseClient<any, "public", any> }
  | { ok: false; status: 401 | 403; error: "Unauthorized" | "Forbidden" }

export async function requireAdmin(): Promise<AdminGate> {
  const supabase = await createSupabaseRouteClient()
  const { data, error } = await supabase.auth.getUser()

  if (error || !data?.user) {
    return { ok: false, status: 401, error: "Unauthorized" }
  }

  const user = data.user as AdminUser
  const roles: string[] = Array.isArray(user?.app_metadata?.roles)
    ? (user!.app_metadata!.roles as string[])
    : []

  const isAdmin =
    roles.includes("admin") ||
    user?.app_metadata?.role === "admin" ||
    user?.user_metadata?.is_admin === true

  if (!isAdmin) {
    return { ok: false, status: 403, error: "Forbidden" }
  }

  return { ok: true, user, supabase }
}

/**
 * Wrap a route handler to require an admin session.
 *
 * Usage in app route:
 *   export const GET = withAdminAuth(async (req, { supabase, user }) => {
 *     const { data } = await supabase.from("seasons").select("*")
 *     return NextResponse.json({ seasons: data })
 *   })
 */
export function withAdminAuth(
  handler: (req: Request, ctx: AdminContext) => Promise<Response>
) {
  return async (req: Request) => {
    const gate = await requireAdmin()
    if (!gate.ok) {
      return NextResponse.json({ _error: gate.error }, { status: gate.status })
    }
    return handler(req, { supabase: gate.supabase, user: gate.user })
  }
}
