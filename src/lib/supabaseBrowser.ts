import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/supabase' // <--- Import this

export const createSupabaseBrowserClient = () =>
  createBrowserClient<Database>( // <--- Add Generic
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )