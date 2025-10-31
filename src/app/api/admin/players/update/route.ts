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

type Body = {
  id: string
  display_name?: string
  forename?: string | null
  surname?: string | null
  avatar_url?: string | null
  bio?: string | null
}

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin()
    if (!auth.ok) return bad(auth.status, auth.msg)
    const supabase = auth.supabase

    const b = (await req.json().catch(() => null)) as Body | null
    if (!b?.id) return bad(400, 'id is required')

    const patch: Record<string, any> = { updated_at: new Date().toISOString() }
    if (typeof b.display_name === 'string') patch.display_name = b.display_name.trim()
    if (typeof b.forename === 'string' || b.forename === null) patch.forename = b.forename?.trim() || null
    if (typeof b.surname === 'string' || b.surname === null) patch.surname = b.surname?.trim() || null
    if (typeof b.avatar_url === 'string' || b.avatar_url === null) patch.avatar_url = b.avatar_url?.trim() || null
    if (typeof b.bio === 'string' || b.bio === null) patch.bio = b.bio?.trim() || null

    const { data, error } = await supabase
      .from('players')
      .update(patch)
      .eq('id', b.id)
      .select('id, display_name, forename, surname, avatar_url, bio')
      .maybeSingle()

    if (error) return bad(500, error.message)
    if (!data) return bad(404, 'Player not found')

    return NextResponse.json({ ok: true, player: data })
  } catch (e: any) {
    return bad(500, e?.message || 'Internal error')
  }
}
