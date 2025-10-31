// Use ONLY on the server (route handlers). Do NOT import this in client code.
import { createClient } from '@supabase/supabase-js'

export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY! // set in .env.local
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}
