import { NextResponse } from 'next/server'
import { createSupabaseRouteClient } from '@/lib/supabaseServer'
import { isAdminUser } from '@/lib/isAdmin'

type Body = { id: string }

export async function POST(req: Request) {
  const supabase = await createSupabaseRouteClient()
  const { data: ures } = await supabase.auth.getUser()
  const isAdmin = isAdminUser(ures?.user)
  if (!isAdmin) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const b = (await req.json().catch(() => null)) as Body | null
  if (!b?.id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 })

  const { error } = await supabase.from('player_aliases').delete().eq('id', b.id)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, message: 'Deleted' })
}
