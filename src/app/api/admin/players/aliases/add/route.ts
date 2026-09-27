import { NextResponse } from 'next/server'
import { createSupabaseRouteClient } from '@/lib/supabaseServer'
import { isAdminUser } from '@/lib/isAdmin'

type Body = { player_id: string | number; alias: string }

export async function POST(req: Request) {
  const supabase = await createSupabaseRouteClient()
  const { data: ures } = await supabase.auth.getUser()
  const isAdmin = isAdminUser(ures?.user)
  if (!isAdmin) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const b = (await req.json().catch(() => null)) as Body | null
  const alias = (b?.alias || '').trim()
  const player_id = Number(b?.player_id)
  if (!Number.isFinite(player_id) || !alias) return NextResponse.json({ ok: false, error: 'player_id and alias required' }, { status: 400 })

  const { data, error } = await supabase
    .from('player_aliases')
    .insert({ player_id, alias, alias_norm: alias.toLowerCase() })
    .select('id, player_id, alias, alias_norm, created_at')
    .single()

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, alias: data })
}
