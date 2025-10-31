import { NextResponse } from 'next/server'
import { createSupabaseRouteClient } from '@/lib/supabaseServer'

export async function GET(req: Request) {
  const supabase = await createSupabaseRouteClient()
  const { data: ures } = await supabase.auth.getUser()
  const roles: string[] = ((ures?.user?.app_metadata as any)?.roles ?? []) as string[]
  const isAdmin = !!ures?.user && (roles.includes('admin') || (ures.user?.user_metadata as any)?.is_admin === true)
  if (!isAdmin) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const player_id = (url.searchParams.get('player_id') || '').trim()
  if (!player_id) return NextResponse.json({ ok: false, error: 'player_id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('player_aliases')
    .select('id, player_id, alias, alias_norm, created_at')
    .eq('player_id', player_id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, aliases: data ?? [] })
}
