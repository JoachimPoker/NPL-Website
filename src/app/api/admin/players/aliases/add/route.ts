import { NextResponse } from 'next/server'
import { createSupabaseRouteClient } from '@/lib/supabaseServer'

type Body = { player_id: string; alias: string }

export async function POST(req: Request) {
  const supabase = await createSupabaseRouteClient()
  const { data: ures } = await supabase.auth.getUser()
  const roles: string[] = ((ures?.user?.app_metadata as any)?.roles ?? []) as string[]
  const isAdmin = !!ures?.user && (roles.includes('admin') || (ures.user?.user_metadata as any)?.is_admin === true)
  if (!isAdmin) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const b = (await req.json().catch(() => null)) as Body | null
  const alias = (b?.alias || '').trim()
  const player_id = (b?.player_id || '').trim()
  if (!player_id || !alias) return NextResponse.json({ ok: false, error: 'player_id and alias required' }, { status: 400 })

  const { data, error } = await supabase
    .from('player_aliases')
    .insert({ player_id, alias, alias_norm: alias.toLowerCase() })
    .select('id, player_id, alias, alias_norm, created_at')
    .single()

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, alias: data })
}
