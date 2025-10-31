import { NextResponse } from 'next/server'
import { createSupabaseRouteClient } from '@/lib/supabaseServer'

export const runtime = 'nodejs'
export const revalidate = 0

type Body = {
  id: string // festivals.id (uuid)
  label?: string
  city?: string | null
  start_date?: string // YYYY-MM-DD
  end_date?: string // YYYY-MM-DD
}

function bad(code: number, msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status: code })
}

async function requireAdmin() {
  const supabase = await createSupabaseRouteClient()
  const { data: ures, error: uerr } = await supabase.auth.getUser()
  if (uerr || !ures?.user) return { ok: false as const, code: 401, msg: 'Unauthorized', supabase }
  const roles: string[] = ((ures.user?.app_metadata as any)?.roles as string[]) || []
  const isAdmin =
    roles.includes('admin') ||
    (ures.user?.app_metadata as any)?.role === 'admin' ||
    (ures.user?.user_metadata as any)?.is_admin === true
  if (!isAdmin) return { ok: false as const, code: 403, msg: 'Forbidden', supabase }
  return { ok: true as const, supabase }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin()
    if (!auth.ok) return bad(auth.code, auth.msg)
    const supabase = auth.supabase

    const body = (await req.json().catch(() => null)) as Body | null
    if (!body) return bad(400, 'Invalid JSON body')

    const { id, label, city, start_date, end_date } = body
    if (!id) return bad(400, 'id is required')

    // Build patch only with provided fields
    const patch: Record<string, any> = { updated_at: new Date().toISOString() }
    if (typeof label === 'string') patch.label = label.trim()
    if (typeof city === 'string' || city === null) patch.city = city
    if (typeof start_date === 'string') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start_date)) return bad(400, 'start_date must be YYYY-MM-DD')
      patch.start_date = start_date.slice(0, 10)
    }
    if (typeof end_date === 'string') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(end_date)) return bad(400, 'end_date must be YYYY-MM-DD')
      patch.end_date = end_date.slice(0, 10)
    }
    if (patch.start_date && patch.end_date && new Date(patch.start_date) > new Date(patch.end_date)) {
      return bad(400, 'start_date cannot be after end_date')
    }

    // Verify it exists first (nice errors)
    const { data: existing, error: exErr } = await supabase
      .from('festivals')
      .select('id')
      .eq('id', id)
      .maybeSingle()
    if (exErr) return bad(500, exErr.message)
    if (!existing) return bad(404, 'Festival not found')

    const { data, error } = await supabase
      .from('festivals')
      .update(patch)
      .eq('id', id)
      .select('id,label,city,start_date,end_date,series_id')
      .maybeSingle()

    if (error) return bad(500, error.message)
    return NextResponse.json({ ok: true, festival: data })
  } catch (e: any) {
    return bad(500, e?.message || 'Internal error')
  }
}
