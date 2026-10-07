import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

// For public pages: reads as an anonymous visitor and never touches cookies, so Next.js
// can cache the page (reading cookies makes every request render from scratch).
// It also means a cached page can never contain something only an admin may see.
export function createSupabasePublicClient() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
