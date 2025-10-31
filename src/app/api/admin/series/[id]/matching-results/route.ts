// src/app/api/admin/series/[id]/matching-results/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseRouteClient } from '@/lib/supabaseServer'

type RouteContext = { params: { id: string } }

/**
 * GET /api/admin/series/:id/matching-results
 *
 * Query params:
 *  - q?: string                // extra substring filter on tournament_name
 *  - season_id?: number        // filter results by season date range
 *  - start_date_from?: string  // YYYY-MM-DD
 *  - start_date_to?: string    // YYYY-MM-DD
 *  - page?: number             // default 1
 *  - pageSize?: number         // default 100
 *  - assigned?: 'all' | 'this' | 'unassigned' | 'other' (optional)
 *      'this'        -> only results currently assigned to this series_id
 *      'unassigned'  -> results where series_id is null
 *      'other'       -> results where series_id is not null AND != this series_id
 *
 * Returns:
 *  {
 *    ok: true,
 *    series: { id, name, slug, description },
 *    page, pageSize, total,
 *    results: Array<{
 *      id, player_id, event_id, tournament_name, start_date,
 *      points, position_of_prize, prize_amount,
 *      series_id, festival_id,
 *      match_key?: string
 *    }>
 *  }
 */

export async function GET(req: Request, { params }: RouteContext) {
  try {
    const supabase = await createSupabaseRouteClient()

    // ---- auth: require admin ----
    const { data: userWrap, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userWrap?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const roles: string[] = ((userWrap.user.app_metadata as any)?.roles ?? []) as string[]
    const isAdmin = roles?.includes('admin') || (userWrap.user.user_metadata as any)?.is_admin === true
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // ---- parse params ----
    const url = new URL(req.url)
    const seriesIdRaw = params.id
    const seriesId = Number(seriesIdRaw)
    if (!Number.isFinite(seriesId)) {
      return NextResponse.json({ error: 'Invalid series id' }, { status: 400 })
    }

    const q = (url.searchParams.get('q') || '').trim()
    const seasonIdParam = url.searchParams.get('season_id')
    const startDateFrom = url.searchParams.get('start_date_from') || undefined
    const startDateTo = url.searchParams.get('start_date_to') || undefined
    const assigned = (url.searchParams.get('assigned') || 'all') as
      | 'all' | 'this' | 'unassigned' | 'other'

    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
    const pageSizeRaw = parseInt(url.searchParams.get('pageSize') || '100', 10)
    const pageSize = Math.min(Math.max(pageSizeRaw || 100, 1), 1000) // cap to 1000
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    // ---- load series (name + description) ----
    const { data: series, error: seriesErr } = await supabase
      .from('series')
      .select('id, name, slug, description')
      .eq('id', seriesId)
      .single()

    if (seriesErr || !series) {
      return NextResponse.json({ error: 'Series not found' }, { status: 404 })
    }

    // Build keyword list: [series.name] + description[]
    const description: string[] = Array.isArray(series.description)
      ? (series.description as any[]).map(String).filter(Boolean)
      : typeof series.description === 'string'
        ? (() => {
            try { const arr = JSON.parse(series.description); return Array.isArray(arr) ? arr.map(String) : [] }
            catch { return [] }
          })()
        : []

    const needles = [String(series.name || '').trim(), ...description].filter(s => s && s.trim().length > 0)
    if (needles.length === 0 && !q) {
      return NextResponse.json({
        ok: true,
        series,
        page, pageSize,
        total: 0,
        results: [],
      })
    }

    // Build OR filter for tournament_name ILIKE %needle%
    // Supabase .or() uses a CSV of conditions like "tournament_name.ilike.%foo%,tournament_name.ilike.%bar%"
    const orParts: string[] = []
    for (const n of needles) {
      const safe = n.replace(/[%]/g, '\\%')
      orParts.push(`tournament_name.ilike.*${safe}*`)
    }
    // If caller also provided q, we add it as an additional AND filter below (to narrow results)

    let query = supabase
      .from('results')
      .select(
        `
        id,
        player_id,
        event_id,
        tournament_name,
        start_date,
        points,
        position_of_prize,
        prize_amount,
        series_id,
        festival_id
        `,
        { count: 'exact' }
      )

    if (orParts.length > 0) {
      // Note: .or() applies to the current query table (results)
      query = query.or(orParts.join(','))
    }

    if (q) {
      const safeQ = q.replace(/[%]/g, '\\%')
      // Further restrict by also containing q
      query = query.ilike('tournament_name', `%${safeQ}%`)
    }

    // Season / date filters
    if (seasonIdParam) {
      const seasonId = parseInt(seasonIdParam, 10)
      if (Number.isFinite(seasonId)) {
        const { data: season, error: seasonErr } = await supabase
          .from('seasons')
          .select('id, start_date, end_date')
          .eq('id', seasonId)
          .single()
        if (seasonErr || !season) {
          return NextResponse.json({ error: 'Invalid season_id' }, { status: 400 })
        }
        query = query.gte('start_date', season.start_date).lte('start_date', season.end_date)
      }
    }
    if (startDateFrom) query = query.gte('start_date', startDateFrom)
    if (startDateTo)   query = query.lte('start_date', startDateTo)

    // Assigned filter
    if (assigned === 'this') {
      query = query.eq('series_id', seriesId)
    } else if (assigned === 'unassigned') {
      query = query.is('series_id', null)
    } else if (assigned === 'other') {
      query = query.neq('series_id', seriesId).not('series_id', 'is', null)
    }

    // Pagination
    query = query.order('start_date', { ascending: false }).range(from, to)

    const { data: rows, error: rowsErr, count } = await query
    if (rowsErr) {
      return NextResponse.json({ error: rowsErr.message || 'Query failed' }, { status: 500 })
    }

    // Annotate with which keyword matched (best-effort, done client-side)
    const lcNeedles = needles.map(s => s.toLowerCase())
    const annotated = (rows || []).map(r => {
      const name = (r.tournament_name || '').toLowerCase()
      const hit = lcNeedles.find(n => n && name.includes(n)) || (q ? q.toLowerCase() : undefined)
      return { ...r, match_key: hit }
    })

    return NextResponse.json({
      ok: true,
      series,
      page,
      pageSize,
      total: count ?? 0,
      results: annotated,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}
