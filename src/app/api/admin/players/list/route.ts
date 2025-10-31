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

export async function GET(req: Request) {
  try {
    const auth = await requireAdmin()
    if (!auth.ok) return bad(auth.status, auth.msg)
    const supabase = auth.supabase

    const url = new URL(req.url)
    const q = (url.searchParams.get('q') || '').trim()
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') || 50)))
    const page = Math.max(1, Number(url.searchParams.get('page') || 1))
    const offset = (page - 1) * limit

    const esc = (s: string) => s.replace(/([,()])/g, '\\$1')
    let qb = supabase
      .from('players')
      .select('id, display_name, forename, surname, avatar_url, bio, created_at, updated_at', { count: 'exact' })
      .order('updated_at', { ascending: false })
      .order('display_name', { ascending: true })

    if (q) {
      const like = `%${esc(q)}%`
      qb = qb.or(
        [
          `display_name.ilike.${like}`,
          `forename.ilike.${like}`,
          `surname.ilike.${like}`,
          `bio.ilike.${like}`,
        ].join(',')
      )
    }

    const { data, error, count } = await qb.range(offset, offset + limit - 1)
    if (error) return bad(500, error.message)

    return NextResponse.json({
      ok: true,
      players: data ?? [],
      total: typeof count === 'number' ? count : (data ?? []).length,
      page,
      limit,
    })
  } catch (e: any) {
    return bad(500, e?.message || 'Internal error')
  }
}
