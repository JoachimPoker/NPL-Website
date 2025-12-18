import { NextResponse } from 'next/server'
import { createSupabaseRouteClient } from '@/lib/supabaseServer'

// Next.js 15 requires params to be a Promise
type RouteContext = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: RouteContext) {
  try {
    const { id } = await params
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
    const seriesId = Number(id)
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
    const pageSize = Math.min(Math.max(pageSizeRaw || 100, 1), 1000)
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    // ---- load series ----
    const { data: series, error: seriesErr } = await supabase
      .from('series')
      .select('id, name, slug, description')
      .eq('id', seriesId)
      .single()

    if (seriesErr || !series) {
      return NextResponse.json({ error: 'Series not found' }, { status: 404 })
    }

    // Build keyword list
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
      return NextResponse.json({ ok: true, series, page, pageSize, total: 0, results: [] })
    }

    // Build OR filter for tournament_name (which exists on 'results')
    const orParts: string[] = []
    for (const n of needles) {
      const safe = n.replace(/[%]/g, '\\%')
      orParts.push(`tournament_name.ilike.*${safe}*`)
    }

    // ---- Main Query ----
    // We Join 'events' to get date and relationship info
    let query = supabase
      .from('results')
      .select(
        `
        id,
        player_id,
        event_id,
        tournament_name,
        points,
        position_of_prize,
        prize_amount,
        events!inner (
            start_date,
            series_id,
            festival_id
        )
        `,
        { count: 'exact' }
      )

    // Apply text search on 'results' table
    if (orParts.length > 0) {
      query = query.or(orParts.join(','))
    }
    if (q) {
      const safeQ = q.replace(/[%]/g, '\\%')
      query = query.ilike('tournament_name', `%${safeQ}%`)
    }

    // --- Filters applied to the joined 'events' table ---
    
    // Season Filter
    if (seasonIdParam) {
      const seasonId = parseInt(seasonIdParam, 10)
      if (Number.isFinite(seasonId)) {
        const { data: season } = await supabase.from('seasons').select('start_date, end_date').eq('id', seasonId).single()
        if (season) {
          // Filter on the joined table using dot notation
          query = query.gte('events.start_date', season.start_date).lte('events.start_date', season.end_date)
        }
      }
    }

    // Date Range Filters
    if (startDateFrom) query = query.gte('events.start_date', startDateFrom)
    if (startDateTo)   query = query.lte('events.start_date', startDateTo)

    // Assigned Filter
    if (assigned === 'this') {
      query = query.eq('events.series_id', seriesId)
    } else if (assigned === 'unassigned') {
      query = query.is('events.series_id', null)
    } else if (assigned === 'other') {
      query = query.neq('events.series_id', seriesId).not('events.series_id', 'is', null)
    }

    // Pagination & Sorting (Sort by foreign column)
    query = query
        .order('start_date', { foreignTable: 'events', ascending: false })
        .range(from, to)

    const { data: rows, error: rowsErr, count } = await query
    
    if (rowsErr) {
      console.error(rowsErr)
      return NextResponse.json({ error: rowsErr.message }, { status: 500 })
    }

    // Annotate results
    const lcNeedles = needles.map(s => s.toLowerCase())
    
    // We map the rows to flatten the structure for the frontend if needed,
    // or just return the nested structure. The original code expected flat fields.
    // We will flatten it here to match expected API response.
    const annotated = (rows || []).map((r: any) => {
      const name = (r.tournament_name || '').toLowerCase()
      const hit = lcNeedles.find(n => n && name.includes(n)) || (q ? q.toLowerCase() : undefined)
      
      return {
        ...r,
        // Flatten the joined event data back to top-level if your frontend expects it
        start_date: r.events?.start_date,
        series_id: r.events?.series_id,
        festival_id: r.events?.festival_id,
        match_key: hit 
      }
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