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
  display_name: string
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
    if (!b) return bad(400, 'Invalid JSON')

    const display_name = (b.display_name || '').trim()
    if (!display_name) return bad(400, 'display_name is required')

    const id = (globalThis as any).crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
    const { data, error } = await supabase
      .from('players')
      .insert({
        id,
        display_name,
        forename: (b.forename ?? '').trim() || null,
        surname: (b.surname ?? '').trim() || null,
        avatar_url: (b.avatar_url ?? '').trim() || null,
        bio: (b.bio ?? '').trim() || null,
        // created_at / updated_at default to now() in DB
      })
      .select('id, display_name, forename, surname, avatar_url, bio')
      .single()

    if (error) return bad(500, error.message)
    return NextResponse.json({ ok: true, player: data })
  } catch (e: any) {
    return bad(500, e?.message || 'Internal error')
  }
}
