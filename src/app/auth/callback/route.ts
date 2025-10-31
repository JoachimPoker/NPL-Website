import { NextResponse } from 'next/server'
import { createSupabaseRouteClient } from '@/lib/supabaseServer'

/**
 * Only needed for OAuth / magic links.
 * For email+password sign-in this route isn't used, but keeping it is harmless.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const redirect = url.searchParams.get('redirect') || '/admin'

  if (code) {
    const supabase = await createSupabaseRouteClient()
    // supabase-js supports this in the SSR client as well
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(new URL(redirect, url.origin))
}
