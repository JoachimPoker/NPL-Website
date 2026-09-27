import { NextResponse } from 'next/server'
import { createSupabaseRouteClient } from '@/lib/supabaseServer'
import { isAdminUser } from '@/lib/isAdmin'

export async function GET(req: Request) {
  const supabase = await createSupabaseRouteClient()
  const { data: ures } = await supabase.auth.getUser()
  const isAdmin = isAdminUser(ures?.user)
  if (!isAdmin) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const player_id = Number(url.searchParams.get('player_id'))
  if (!Number.isFinite(player_id) || player_id <= 0) return NextResponse.json({ ok: false, error: 'player_id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('player_aliases')
    .select('id, player_id, alias, alias_norm, created_at')
    .eq('player_id', player_id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, aliases: data ?? [] })
}
