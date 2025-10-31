// src/app/api/admin/results/assign-series/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseRouteClient } from '@/lib/supabaseServer'

type AssignSeriesBody = {
  /** Array of result UUID strings to update */
  result_ids: string[]
  /** Target series id (numeric) OR null to clear */
  series_id?: number | null
  /** Alternatively, pass a slug (e.g. "gukpt", "other"). If both provided, series_id wins. */
  series_slug?: string | null
}

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseRouteClient()

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
    const body = (await req.json()) as Partial<AssignSeriesBody>
    const ids = Array.isArray(body.result_ids) ? body.result_ids.filter(Boolean) : []

    if (!ids.length) {
      return NextResponse.json({ error: 'result_ids is required (non-empty array)' }, { status: 400 })
    }

    // Resolve target series_id
    let targetSeriesId: number | null | undefined = body.series_id

    if (typeof targetSeriesId === 'undefined') {
      // allow series_slug fallback
      const slug = (body.series_slug || '').trim().toLowerCase()
      if (slug.length > 0) {
        const { data: s, error: sErr } = await supabase
          .from('series')
          .select('id, slug')
          .ilike('slug', slug) // case-insensitive match on slug
          .limit(1)
          .maybeSingle()

        if (sErr) {
          return NextResponse.json({ error: sErr.message || 'Failed to resolve series_slug' }, { status: 500 })
        }
        if (!s) {
          return NextResponse.json({ error: `Series with slug "${slug}" not found` }, { status: 404 })
        }
        targetSeriesId = s.id as number
      } else {
        // If neither series_id nor series_slug provided, we interpret as "clear"
        targetMethodLog('No series_id/slug provided; will clear series_id on results.')
        targetSeriesId = null
      }
    }

    // If series_id given but not null, ensure it exists (defensive)
    if (typeof targetSeriesId === 'number') {
      const { data: exists, error: checkErr } = await supabase
        .from('series')
        .select('id')
        .eq('id', targetSeriesId)
        .maybeSingle()
      if (checkErr) {
        return NextResponse.json({ error: checkErr.message || 'Series check failed' }, { status: 500 })
      }
      if (!exists) {
        return NextResponse.json({ error: `Series id ${targetSeriesId} not found` }, { status: 404 })
      }
    }

    // ---- Perform bulk update on results ----
    // Use .select('id') after update to get count of affected rows.
    const { data: updated, error: updErr } = await supabase
      .from('results')
      .update({ series_id: targetSeriesId ?? null })
      .in('id', ids)
      .select('id')

    if (updErr) {
      return NextResponse.json({ error: updErr.message || 'Update failed' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      updated_count: updated?.length ?? 0,
      series_id: targetSeriesId ?? null,
      result_ids: ids,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}

/** Tiny helper just to make intent explicit in code; no-op besides helping reading logs */
function targetMethodLog(msg: string) {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.debug('[assign-series]', msg)
  }
}
