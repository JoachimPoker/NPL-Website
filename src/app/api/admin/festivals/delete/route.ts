// src/app/api/admin/festivals/delete/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseRouteClient } from '@/lib/supabaseServer'

type DeleteBody = {
  /** UUID of the festival to delete */
  id: string
}

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code })
}

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseRouteClient()

    // --- Admin auth guard ---
    const { data: userWrap, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userWrap?.user) {
      return bad('Unauthorized', 401)
    }
    const roles: string[] = ((userWrap.user.app_metadata as any)?.roles ?? []) as string[]
    const isAdmin = roles?.includes('admin') || (userWrap.user.user_metadata as any)?.is_admin === true
    if (!isAdmin) return bad('Forbidden', 403)

    const body = (await req.json()) as Partial<DeleteBody>
    const id = (body.id ?? '').toString().trim()
    if (!id) return bad('id is required')

    // Ensure the festival exists
    const { data: existing, error: getErr } = await supabase
      .from('festivals')
      .select('id, series_id')
      .eq('id', id)
      .maybeSingle()

    if (getErr) return bad(getErr.message, 500)
    if (!existing) return bad('Festival not found', 404)

    // 1) Clear any event->festival_id links (let update return affected rows, then count them)
    const { data: clearedRows, error: clrErr } = await supabase
      .from('events')
      .update({ festival_id: null })
      .eq('festival_id', id)
      .select('id') // returns affected rows; TS-friendly signature
    if (clrErr) return bad(`Failed to clear event links: ${clrErr.message}`, 500)

    const cleared = Array.isArray(clearedRows) ? clearedRows.length : 0

    // 2) Delete the festival itself
    const { error: delErr } = await supabase
      .from('festivals')
      .delete()
      .eq('id', id)

    if (delErr) return bad(`Failed to delete festival: ${delErr.message}`, 500)

    return NextResponse.json({
      ok: true,
      deleted_id: id,
      cleared_events: cleared,
      message: `Deleted festival ${id}, cleared ${cleared} linked event(s).`,
    })
  } catch (err: any) {
    return bad(err?.message || 'Internal error', 500)
  }
}
