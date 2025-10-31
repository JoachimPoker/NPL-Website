// src/app/api/admin/festivals/list/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseRouteClient } from '@/lib/supabaseServer'

type ListResponse = {
  ok: true
  festivals: Array<{
    id: string
    label: string
    city: string | null
    start_date: string
    end_date: string
    series_id: number | null
    season_id: number | null
  }>
  total: number
  page: number
  pageSize: number
} | {
  ok: false
  error: string
}

export async function GET(req: Request): Promise<Response> {
  try {
    const supabase = await createSupabaseRouteClient()

    // --- Auth: only admins may list/manage festivals in /api/admin ---
    const { data: userWrap, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userWrap?.user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' } as ListResponse, { status: 401 })
    }
    const roles: string[] = ((userWrap.user.app_metadata as any)?.roles ?? []) as string[]
    const isAdmin = roles?.includes('admin') || (userWrap.user.user_metadata as any)?.is_admin === true
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: 'Forbidden' } as ListResponse, { status: 403 })
    }

    // --- Parse querystring ---
    const url = new URL(req.url)
    const qp = url.searchParams

    const seriesIdStr   = qp.get('series_id')
    const seasonIdStr   = qp.get('season_id')
    const q             = (qp.get('q') ?? '').trim()
    const startFrom     = (qp.get('start_from') ?? '').trim()   // e.g. '2025-01-01'
    const startTo       = (qp.get('start_to') ?? '').trim()
    const endFrom       = (qp.get('end_from') ?? '').trim()
    const endTo         = (qp.get('end_to') ?? '').trim()
    const sort          = (qp.get('sort') ?? 'start_date.asc').toLowerCase() // 'start_date.asc' | 'start_date.desc'
    const page          = Math.max(1, parseInt(qp.get('page') ?? '1', 10) || 1)
    const pageSize      = Math.min(200, Math.max(1, parseInt(qp.get('pageSize') ?? '50', 10) || 50))

    const from = (page - 1) * pageSize
    const to   = from + pageSize - 1

    // --- Build query ---
    let query = supabase
      .from('festivals')
      .select('id,label,city,start_date,end_date,series_id,season_id', { count: 'exact' })

    if (seriesIdStr) {
      const idNum = Number(seriesIdStr)
      if (!Number.isNaN(idNum)) {
        query = query.eq('series_id', idNum)
      } else {
        // also allow ?series_id=other to mean "null"
        if (seriesIdStr.toLowerCase() === 'null' || seriesIdStr.toLowerCase() === 'none' || seriesIdStr.toLowerCase() === 'other') {
          query = query.is('series_id', null)
        }
      }
    }

    if (seasonIdStr) {
      const sid = Number(seasonIdStr)
      if (!Number.isNaN(sid)) {
        query = query.eq('season_id', sid)
      } else if (seasonIdStr.toLowerCase() === 'null' || seasonIdStr.toLowerCase() === 'none') {
        query = query.is('season_id', null)
      }
    }

    if (q) {
      // case-insensitive search on label or city
      const like = `%${q.replaceAll('%','\\%').replaceAll('_','\\_')}%`
      query = query.or(`label.ilike.${like},city.ilike.${like}`)
    }

    if (startFrom && /^\d{4}-\d{2}-\d{2}$/.test(startFrom)) {
      query = query.gte('start_date', startFrom)
    }
    if (startTo && /^\d{4}-\d{2}-\d{2}$/.test(startTo)) {
      query = query.lte('start_date', startTo)
    }
    if (endFrom && /^\d{4}-\d{2}-\d{2}$/.test(endFrom)) {
      query = query.gte('end_date', endFrom)
    }
    if (endTo && /^\d{4}-\d{2}-\d{2}$/.test(endTo)) {
      query = query.lte('end_date', endTo)
    }

    const asc = !/desc$/.test(sort)
    query = query.order('start_date', { ascending: asc, nullsFirst: false })

    // Pagination using range
    query = query.range(from, to)

    const { data, error, count } = await query
    if (error) {
      return NextResponse.json({ ok: false, error: error.message } as ListResponse, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      festivals: (data ?? []) as any[],
      total: count ?? 0,
      page,
      pageSize,
    } as ListResponse)
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Internal error' } as ListResponse, { status: 500 })
  }
}
