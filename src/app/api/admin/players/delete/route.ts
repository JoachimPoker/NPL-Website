import { NextResponse } from 'next/server'
import { createSupabaseRouteClient } from '@/lib/supabaseServer'

export const runtime = 'nodejs'
export const revalidate = 0

const bad = (s: number, m: string) => NextResponse.json({ ok: false, error: m }, { status: s })

async function requireAdmin() {
  const supabase = await createSupabaseRouteClient()
  const { data: ures, error } = await supabase.auth.getUser()
  if (error || !ures?.user) return { ok: false as const, status: 401, msg: 'Unauthorized', supabase }
  const roles: string[] = ((ures.user.app_metadata as any)?.roles ?? []) as string[]
  const isAdmin = roles.includes('admin') || (ures.user.user_metadata as any)?.is_admin === true
  if (!isAdmin) return { ok: false as const, status: 403, msg: 'Forbidden', supabase }
  return { ok: true as const, supabase }
}

type Body = { id: string }

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin()
    if (!auth.ok) return bad(auth.status, auth.msg)
    const supabase = auth.supabase

    const b = (await req.json().catch(() => null)) as Body | null
    if (!b?.id) return bad(400, 'id is required')

    const { error } = await supabase.from('players').delete().eq('id', b.id)
    if (error) return bad(500, error.message)

    return NextResponse.json({ ok: true, message: 'Deleted' })
  } catch (e: any) {
    return bad(500, e?.message || 'Internal error')
  }
}
