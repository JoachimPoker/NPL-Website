// src/app/api/admin/festivals/create/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseRouteClient } from '@/lib/supabaseServer'

type CreateFestivalBody = {
  /** Display label, e.g. "UKPL Liverpool – March Stop" */
  label: string
  /** Optional city label, e.g. "Liverpool" */
  city?: string | null
  /** ISO date strings "YYYY-MM-DD" */
  start_date: string
  end_date: string
  /** Link to series (either id or slug). One of these may be provided. */
  series_id?: number | null
  series_slug?: string | null
  /** Optional season foreign key if you want to bind to a Season row */
  season_id?: number | null
}

function jsonBadRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 })
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

    // ---- Parse & validate body ----
    const body = (await req.json()) as Partial<CreateFestivalBody>
    const label = (body.label ?? '').toString().trim()
    const city = (body.city ?? null) as string | null
    const start_date = (body.start_date ?? '').toString().slice(0, 10)
    const end_date = (body.end_date ?? '').toString().slice(0, 10)
    let { series_id, series_slug, season_id } = body

    if (!label) return jsonBadRequest('label is required')
    if (!start_date || !/^\d{4}-\d{2}-\d{2}$/.test(start_date)) {
      return jsonBadRequest('start_date must be YYYY-MM-DD')
    }
    if (!end_date || !/^\d{4}-\d{2}-\d{2}$/.test(end_date)) {
      return jsonBadRequest('end_date must be YYYY-MM-DD')
    }
    if (new Date(start_date) > new Date(end_date)) {
      return jsonBadRequest('start_date cannot be after end_date')
    }

    // ---- Resolve series_id from series_slug if needed ----
    let resolvedSeriesId: number | null = null
    if (typeof series_id === 'number') {
      // verify existence
      const { data: s, error: sErr } = await supabase
        .from('series')
        .select('id')
        .eq('id', series_id)
        .maybeSingle()
      if (sErr) return NextResponse.json({ error: sErr.message || 'Series lookup failed' }, { status: 500 })
      if (!s) return jsonBadRequest(`series_id ${series_id} not found`)
      resolvedSeriesId = series_id
    } else if (typeof series_slug === 'string' && series_slug.trim() !== '') {
      const slug = series_slug.trim().toLowerCase()
      const { data: s, error: sErr } = await supabase
        .from('series')
        .select('id, slug')
        .ilike('slug', slug)
        .maybeSingle()
      if (sErr) return NextResponse.json({ error: sErr.message || 'Series lookup failed' }, { status: 500 })
      if (!s) return jsonBadRequest(`series_slug "${slug}" not found`)
      resolvedSeriesId = s.id as number
    } // else leave as null

    // ---- Optional: validate season_id if provided ----
    let resolvedSeasonId: number | null = null
    if (typeof season_id === 'number') {
      const { data: season, error: seasonErr } = await supabase
        .from('seasons')
        .select('id')
        .eq('id', season_id)
        .maybeSingle()
      if (seasonErr) return NextResponse.json({ error: seasonErr.message || 'Season lookup failed' }, { status: 500 })
      if (!season) return jsonBadRequest(`season_id ${season_id} not found`)
      resolvedSeasonId = season_id
    }

    // ---- Insert festival ----
    const { data: inserted, error: insErr } = await supabase
      .from('festivals')
      .insert({
        label,
        city,
        start_date,
        end_date,
        series_id: resolvedSeriesId,
        season_id: resolvedSeasonId,
      })
      .select('id, label, city, start_date, end_date, series_id, season_id')
      .single()

    if (insErr) {
      return NextResponse.json({ error: insErr.message || 'Insert failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, festival: inserted })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}
