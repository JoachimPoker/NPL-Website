import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export const runtime = "nodejs";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient()

    // ---- Auth: require admin ----
    const { data: userWrap, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userWrap?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const roles: string[] = ((userWrap.user.app_metadata as any)?.roles ?? []) as string[]
    const isAdmin = roles?.includes('admin') || (userWrap.user.user_metadata as any)?.is_admin === true
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // ---- Parse body ----
    const body = await req.json()
    const ids = Array.isArray(body.result_ids) ? body.result_ids.filter(Boolean) : []

    if (!ids.length) {
      return NextResponse.json({ error: 'result_ids is required (non-empty array)' }, { status: 400 })
    }

    // Resolve target series_id
    let targetSeriesId: number | null = body.series_id ?? null

    // If a slug is provided (and no direct series_id), verify it exists
    if (body.series_slug && targetSeriesId === null) {
      const slug = body.series_slug.trim().toLowerCase()
      const { data: s, error: sErr } = await supabase
        .from('series')
        .select('id')
        .ilike('slug', slug)
        .maybeSingle()

      if (sErr) {
        return NextResponse.json({ error: sErr.message }, { status: 500 })
      }
      if (!s) {
        return NextResponse.json({ error: `Series slug "${slug}" not found` }, { status: 404 })
      }
      targetSeriesId = s.id
    }

    // ---- Step 1: Find linked Events ----
    // We cannot update 'results' directly because 'series_id' lives on 'events'.
    const { data: results, error: fetchErr } = await supabase
      .from('results')
      .select('event_id')
      .in('id', ids)

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

    // Extract unique Event IDs
    const eventIds = Array.from(new Set(results.map((r) => r.event_id).filter(Boolean)))

    if (eventIds.length === 0) {
      return NextResponse.json({ ok: true, count: 0, message: 'No linked events found' })
    }

    // ---- Step 2: Update the Events ----
    const { error: updErr } = await supabase
      .from('events')
      .update({ 
        series_id: targetSeriesId,
        updated_at: new Date().toISOString()
      })
      .in('id', eventIds)

    if (updErr) {
      return NextResponse.json({ error: updErr.message || 'Update failed' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      updated_count: eventIds.length,
      series_id: targetSeriesId
    })

  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}