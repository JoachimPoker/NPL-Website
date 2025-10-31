// src/app/api/admin/festivals/assign-event/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseRouteClient } from '@/lib/supabaseServer'

export const runtime = 'nodejs'
export const revalidate = 0

type Body = {
  event_ids?: Array<string | number>
  festival_id: string | null // assuming festivals.id is UUID (text) in your DB
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
    const admin = await requireAdmin()
    if (!admin.ok) return bad(admin.code, admin.msg)
    const supabase = admin.supabase

    const body = (await req.json().catch(() => null)) as Body | null
    if (!body) return bad(400, 'Invalid JSON body')

    const { event_ids, festival_id } = body

    if (!Array.isArray(event_ids) || event_ids.length === 0) {
      return bad(400, "Provide non-empty 'event_ids' array.")
    }

    // If we're setting a festival (not clearing), verify it exists
    if (festival_id) {
      const { data: f, error: ferr } = await supabase
        .from('festivals')
        .select('id')
        .eq('id', festival_id)
        .maybeSingle()
      if (ferr) return bad(500, ferr.message)
      if (!f) return bad(400, 'festival_id not found')
    }

    // Coerce numeric-looking IDs to numbers so Postgres uses the bigint index and
    // doesn't attempt uuid casting.
    const idsAsStrings = event_ids.map(v => String(v)).filter(Boolean)
    const allDigits = idsAsStrings.every(v => /^\d+$/.test(v))
    const ids = allDigits ? idsAsStrings.map(v => Number(v)) : idsAsStrings

    const { data, error } = await supabase
      .from('events')
      .update({
        festival_id: festival_id ?? null,
        updated_at: new Date().toISOString(),
      })
      .in('id', ids as any)
      .eq('is_deleted', false)
      .select('id, festival_id')

    if (error) return bad(500, error.message)

    return NextResponse.json({
      ok: true,
      count: data?.length ?? 0,
      updated: data ?? [],
    })
  } catch (e: any) {
    return bad(500, e?.message || 'Internal error')
  }
}
