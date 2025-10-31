// src/lib/supabaseServer.ts
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Create a Supabase client for Server Components (read-only cookies).
 * Use this in RSC/page/server components where cookie writes aren't allowed.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies(); // Next 15: async
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(_name: string, _value: string, _options: CookieOptions) {
          // no-op in RSC to avoid Next warnings about setting cookies
        },
        remove(_name: string, _options: CookieOptions) {
          // no-op in RSC
        },
      },
    }
  );
}

/**
 * Create a Supabase client for Route Handlers (cookie writes allowed).
 * Use this in /app/api/** route handlers.
 */
export async function createSupabaseRouteClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies(); // Next 15: async
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          // You can also use cookieStore.delete(name) if you prefer
          cookieStore.set({ name, value: "", ...options });
        },
      },
    }
  );
}
