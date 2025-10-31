'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'

type Series = {
  id: number
  name: string
  slug?: string | null
  description?: string | null
}

type Festival = {
  id: string
  series_id: number | null
  label: string
  city: string | null
  start_date: string
  end_date: string
}

type ResultRow = {
  id: string
  tournament_name: string | null
  start_date: string | null
  series_id: number | null
  series_slug?: string | null
  festival_id: string | null
}

type SeriesListResp = {
  series: Array<{ id: number; name?: string | null; slug?: string | null; description?: string | null }>
  _error?: string
}
type SeriesGetResp = { ok?: boolean; series?: Series; _error?: string }
type EventsResp = { ok?: boolean; results?: ResultRow[]; total?: number; _error?: string }
type FestivalsResp = { ok?: boolean; festivals?: Festival[]; _error?: string }

/** Lightweight modal (no external libs) */
function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title?: string
  onClose: () => void
  children: React.ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-semibold">{title || 'Modal'}</h2>
          <button className="rounded-md border px-2 py-1 text-sm" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

export default function AdminSeriesManagePage() {
  const params = useParams() as { id?: string }
  const searchParams = useSearchParams()
  const router = useRouter()
  const seriesId = Number(params?.id ?? 0)

  // data
  const [series, setSeries] = useState<Series | null>(null)
  const [allSeries, setAllSeries] = useState<Series[]>([])
  const [festivals, setFestivals] = useState<Festival[]>([])
  const [results, setResults] = useState<ResultRow[]>([])
  const [total, setTotal] = useState(0)

  // filters + pagination
  const [q, setQ] = useState<string>(searchParams.get('q') ?? '')
  const [onlyUnassigned, setOnlyUnassigned] = useState<boolean>((searchParams.get('unassigned') ?? '') === '1')
  const [page, setPage] = useState<number>(Number(searchParams.get('page') || 1) || 1)
  const [pageSize, setPageSize] = useState<number>(Number(searchParams.get('limit') || 100) || 100)

  // ui state
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  // selection
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const selectedIds = useMemo(() => Object.entries(selected).filter(([, v]) => v).map(([id]) => id), [selected])

  // Festival modal: supports both Create and Edit
  type FestMode = 'create' | 'edit'
  const [festModalOpen, setFestModalOpen] = useState(false)
  const [festMode, setFestMode] = useState<FestMode>('create')
  const [editingFestId, setEditingFestId] = useState<string | null>(null)
  const [festForm, setFestForm] = useState<{ label: string; city: string; start_date: string; end_date: string }>({
    label: '',
    city: '',
    start_date: '',
    end_date: '',
  })

  // URL fallback for opening modal (preserve your existing ?newFest=1)
  const showNewFestUrl = (searchParams.get('newFest') ?? '') === '1'
  useEffect(() => {
    if (showNewFestUrl) {
      setFestMode('create')
      setEditingFestId(null)
      setFestModalOpen(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showNewFestUrl])

  // focus first input
  const firstInputRef = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    if (festModalOpen && firstInputRef.current) {
      const t = setTimeout(() => firstInputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [festModalOpen])

  function openCreateFestival() {
    setFestMode('create')
    setEditingFestId(null)
    setFestForm({ label: '', city: '', start_date: '', end_date: '' })
    setFestModalOpen(true)
    const sp = new URLSearchParams(Array.from(searchParams.entries()))
    sp.set('newFest', '1')
    router.replace(`/admin/series/${seriesId}?${sp.toString()}`)
  }

  function openEditFestival(f: Festival) {
    setFestMode('edit')
    setEditingFestId(f.id)
    setFestForm({
      label: f.label,
      city: f.city ?? '',
      start_date: f.start_date ?? '',
      end_date: f.end_date ?? '',
    })
    setFestModalOpen(true)
    // optional: set a URL flag for edit if you want deep-linking;
    // keeping it simple: no URL change for edit.
  }

  function closeFestivalModal() {
    setFestModalOpen(false)
    setEditingFestId(null)
    const sp = new URLSearchParams(Array.from(searchParams.entries()))
    sp.delete('newFest')
    router.replace(sp.size ? `/admin/series/${seriesId}?${sp.toString()}` : `/admin/series/${seriesId}`)
  }

  // edit series
  const [editingSeries, setEditingSeries] = useState(false)
  const [form, setForm] = useState<{ name: string; slug: string; description: string }>({
    name: '',
    slug: '',
    description: '',
  })

  // ----- loaders -----
  async function loadSeriesDetails() {
    if (!seriesId) return
    setErr(null)
    try {
      const r = await fetch(`/api/admin/series/get?id=${seriesId}`, { cache: 'no-store' })
      if (r.ok) {
        const js: SeriesGetResp = await r.json()
        if (js?.series) {
          const s = js.series
          setSeries(s)
          setForm({ name: s.name || '', slug: s.slug || '', description: s.description || '' })
          return
        }
      }
      const r2 = await fetch('/api/admin/series/list', { cache: 'no-store' })
      const js2: SeriesListResp = await r2.json()
      if (!r2.ok) throw new Error(js2?._error || r2.statusText)
      const list = (js2.series || []).map(s => ({
        id: s.id,
        name: (s.name ?? '') as string,
        slug: s.slug ?? null,
        description: (s.description ?? s.description ?? '') || null,
      }))
      const found = list.find(s => s.id === seriesId)
      if (!found) throw new Error('Series not found')
      setSeries(found)
      setForm({ name: found.name || '', slug: found.slug || '', description: found.description || '' })
    } catch (e: any) {
      setErr(e?.message || String(e))
    }
  }

  async function loadSeriesOptions() {
    try {
      const r = await fetch('/api/admin/series/list', { cache: 'no-store' })
      const js: SeriesListResp = await r.json()
      if (!r.ok) throw new Error(js?._error || r.statusText)
      const list: Series[] = (js.series || []).map(s => ({
        id: s.id,
        name: (s.name ?? '') as string,
        slug: s.slug ?? null,
        description: (s.description ?? s.description ?? '') || null,
      }))
      setAllSeries(list.slice().sort((a, b) => a.name.localeCompare(b.name)))
    } catch (e: any) {
      setErr(e?.message || String(e))
    }
  }

  async function loadFestivals() {
    if (!seriesId) return
    try {
      const r = await fetch(`/api/admin/festivals/list?series_id=${seriesId}`, { cache: 'no-store' })
      const js: FestivalsResp = await r.json()
      if (!r.ok) throw new Error(js?._error || r.statusText)
      setFestivals(js.festivals || [])
    } catch (e: any) {
      setErr(e?.message || String(e))
    }
  }

  async function loadResults() {
    if (!seriesId) return
    setLoading(true)
    setErr(null); setOk(null)
    try {
      const params = new URLSearchParams()
      if (q.trim()) params.set('q', q.trim())
      if (onlyUnassigned) params.set('unassigned_only', '1')
      params.set('limit', String(pageSize))
      params.set('offset', String((page - 1) * pageSize))

      const r = await fetch(`/api/admin/series/${seriesId}/events?` + params.toString(), { cache: 'no-store' })
      const js: EventsResp = await r.json()
      if (!r.ok || js.ok === false) throw new Error(js?._error || r.statusText)

      const list = js.results || []
      setResults(list)
      setTotal(js.total ?? list.length)

      const map: Record<string, boolean> = {}
      for (const row of list) map[row.id] = false
      setSelected(map)
    } catch (e: any) {
      setErr(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!seriesId) return
    ;(async () => {
      await Promise.all([loadSeriesDetails(), loadSeriesOptions(), loadFestivals()])
      await loadResults()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesId])

  useEffect(() => {
    if (!seriesId) return
    const sp = new URLSearchParams()
    if (q.trim()) sp.set('q', q.trim())
    if (onlyUnassigned) sp.set('unassigned', '1')
    if (page !== 1) sp.set('page', String(page))
    if (pageSize !== 100) sp.set('limit', String(pageSize))
    const qs = sp.toString()
    const base = `/admin/series/${seriesId}`
    router.replace(qs ? `${base}?${qs}` : base)
    void loadResults()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, onlyUnassigned, page, pageSize])

  // ----- actions -----
  async function saveFestival() {
    if (!series) return
    const payload = {
      series_id: series.id,
      label: festForm.label.trim(),
      city: festForm.city.trim() || null,
      start_date: festForm.start_date,
      end_date: festForm.end_date,
    }
    if (!payload.label || !payload.start_date || !payload.end_date) {
      setErr('Please fill label, start and end date.')
      return
    }

    setErr(null); setOk(null)

    // Branch: create vs update
    if (festMode === 'create' || !editingFestId) {
      const r = await fetch('/api/admin/festivals/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const js = await r.json()
      if (!r.ok || js.ok === false) {
        setErr(js?.error || r.statusText)
        return
      }
      setOk('Festival created.')
    } else {
      // edit mode: PATCH via /update
      const r = await fetch('/api/admin/festivals/update', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: editingFestId,
          label: payload.label,
          city: payload.city,
          start_date: payload.start_date,
          end_date: payload.end_date,
        }),
      })
      const js = await r.json()
      if (!r.ok || js.ok === false) {
        setErr(js?.error || r.statusText)
        return
      }
      setOk('Festival updated.')
    }

    setFestForm({ label: '', city: '', start_date: '', end_date: '' })
    setEditingFestId(null)
    setFestModalOpen(false)
    const sp = new URLSearchParams(Array.from(searchParams.entries()))
    sp.delete('newFest')
    router.replace(sp.size ? `/admin/series/${seriesId}?${sp.toString()}` : `/admin/series/${seriesId}`)
    await loadFestivals()
  }

  async function assignFestivalTo(ids: string[], festival_id: string | null) {
    if (!ids.length) return
    setErr(null); setOk(null); setLoading(true)
    try {
      const r = await fetch('/api/admin/festivals/assign-event', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ event_ids: ids, festival_id }),
      })
      const js = await r.json()
      if (!r.ok || js.ok === false) throw new Error(js?.error || r.statusText)
      setOk(`Updated ${js.count || ids.length} event(s).`)
      await loadResults()
      await loadFestivals()
    } catch (e: any) {
      setErr(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  async function setSeriesFor(ids: string[], op: 'assign' | 'clear') {
    if (!seriesId || !ids.length) return
    setErr(null); setOk(null); setLoading(true)
    try {
      const r = await fetch(`/api/admin/series/${seriesId}/events`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ event_ids: ids, op }),
      })
      const js = await r.json()
      if (!r.ok || js.ok === false) throw new Error(js?._error || r.statusText)
      const label = op === 'assign' ? 'assigned to this series' : 'cleared from series'
      setOk(`Successfully ${label} (${js.updated_count ?? ids.length}).`)
      await loadResults()
    } catch (e: any) {
      setErr(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  async function reassignSeriesFor(ids: string[], targetSeriesId: number) {
    if (!ids.length || !targetSeriesId) return
    setErr(null); setOk(null); setLoading(true)
    try {
      const r = await fetch('/api/admin/events/assign-series', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ event_ids: ids, series_id: targetSeriesId }),
      })
      const js = await r.json()
      if (!r.ok || js.ok === false) throw new Error(js?._error || r.statusText)
      setOk(`Moved ${js.updated_count ?? ids.length} event(s) to series #${targetSeriesId}.`)
      await loadResults()
    } catch (e: any) {
      setErr(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  const toggleAll = (checked: boolean) => {
    const next: Record<string, boolean> = {}
    results.forEach(r => { next[r.id] = checked })
    setSelected(next)
  }

  const renderSeriesOptions = () => {
    const items = allSeries.slice().sort((a, b) => a.name.localeCompare(b.name))
    return items.map(s => (
      <option key={s.id} value={s.id} title={s.slug ? s.slug : undefined}>
        {s.name}
      </option>
    ))
  }

  async function saveSeries() {
    if (!seriesId) return
    setErr(null); setOk(null); setLoading(true)
    try {
      const res = await fetch('/api/admin/series/update', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: seriesId,
          name: form.name.trim(),
          slug: form.slug.trim() || null,
          description: form.description ?? '',
        }),
      })
      const js = await res.json()
      if (!res.ok) throw new Error(js?._error || res.statusText)
      setOk('Series saved.')
      setEditingSeries(false)
      await loadSeriesDetails()
      await loadSeriesOptions()
    } catch (e: any) {
      setErr(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  // ----- ui -----
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const canPrev = page > 1
  const canNext = page < pageCount

  return (
    <div className="space-y-6">
      {/* Top admin card */}
      <section className="card">
        <div className="card-header flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Admin — Series</h1>
          <div className="flex items-center gap-2">
            <a className="rounded-md border px-3 py-1.5 text-sm" href="/admin">Dashboard</a>
            <a className="rounded-md border px-3 py-1.5 text-sm" href="/admin/series">All Series</a>
          </div>
        </div>
        <div className="card-body">
          <div className="text-sm text-neutral-600">
            Managing series: <b>{series?.name ?? `#${seriesId}`}</b>
          </div>
        </div>
      </section>

      {/* Series details / editor */}
      <section className="card">
        <div className="card-header flex items-center justify-between">
          <span>Series details</span>
          {!editingSeries && (
            <button className="rounded-md border px-3 py-1.5 text-sm" onClick={() => setEditingSeries(true)}>
              Edit
            </button>
          )}
        </div>
        <div className="card-body space-y-3">
          {!editingSeries ? (
            <div className="grid gap-3 md:grid-cols-3 text-sm">
              <div>
                <div className="text-neutral-500">Name</div>
                <div className="font-medium">{series?.name || '—'}</div>
              </div>
              <div>
                <div className="text-neutral-500">Slug</div>
                <div className="font-mono">{series?.slug || '—'}</div>
              </div>
              <div className="md:col-span-3">
                <div className="text-neutral-500">Description</div>
                <div className="whitespace-pre-wrap">{series?.description || '—'}</div>
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="block text-sm text-neutral-600">Name</label>
                  <input
                    className="w-full border rounded px-2 py-1"
                    value={form.name}
                    onChange={(e) => setForm(s => ({ ...s, name: e.target.value }))}
                    placeholder="e.g., GUKPT"
                  />
                </div>
                <div>
                  <label className="block text-sm text-neutral-600">Slug</label>
                  <input
                    className="w-full border rounded px-2 py-1"
                    value={form.slug}
                    onChange={(e) => setForm(s => ({ ...s, slug: e.target.value }))}
                    placeholder="gukpt"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-neutral-600">Description</label>
                <textarea
                  className="w-full border rounded px-2 py-1"
                  rows={4}
                  value={form.description}
                  onChange={(e) => setForm(s => ({ ...s, description: e.target.value }))}
                  placeholder="Shown on the public series page."
                />
              </div>
              <div className="flex gap-2">
                <button className="rounded-md border px-3 py-1.5 text-sm" onClick={() => void saveSeries()} disabled={loading}>
                  Save
                </button>
                <button
                  className="rounded-md border px-3 py-1.5 text-sm"
                  onClick={() => {
                    setEditingSeries(false)
                    if (series) {
                      setForm({
                        name: series.name || '',
                        slug: series.slug || '',
                        description: series.description || '',
                      })
                    }
                  }}
                  disabled={loading}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Filters / actions */}
      <section className="card">
        <div className="card-header flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-semibold">Results for “{series?.name ?? `#${seriesId}` }”</span>
            <span className="badge">{total} results</span>
            {loading && <span className="text-xs text-neutral-500">Loading…</span>}
          </div>
        </div>

        <div className="card-body space-y-3">
          {err && <div className="p-2 rounded bg-red-100 text-red-700 text-sm">{err}</div>}
          {ok && <div className="p-2 rounded bg-green-100 text-green-700 text-sm">{ok}</div>}

          <div className="grid md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-sm text-neutral-600">Search tournament name</label>
              <input
                className="w-full border rounded px-2 py-1"
                placeholder="e.g. Goliath, UKPL, Main, Bounty…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadResults()}
              />
              <p className="text-xs text-neutral-500 mt-1">
                Served by <code>/api/admin/series/{seriesId}/events</code>.
              </p>
            </div>
            <div className="flex items-end gap-3">
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={onlyUnassigned} onChange={(e) => setOnlyUnassigned(e.target.checked)} />
                Only results without a festival
              </label>
              <label className="text-sm inline-flex items-center gap-2">
                Page size:
                <select
                  className="border rounded px-2 py-1 text-sm"
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
              </label>
              <button className="rounded-md border px-3 py-1.5 text-sm" onClick={() => void loadResults()} disabled={loading}>
                Refresh
              </button>
            </div>
          </div>

          {/* Bulk actions row */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-sm text-neutral-600">
              Selected: <b>{selectedIds.length}</b>
            </span>

            {/* Assign/clear to THIS series */}
            <div className="flex items-center gap-2">
              <button
                className="rounded-md border px-3 py-1.5 text-sm"
                disabled={!selectedIds.length || loading}
                onClick={() => void setSeriesFor(selectedIds, 'assign')}
                title="Set series_id on selected events to this series"
              >
                Assign to this series
              </button>
              <button
                className="rounded-md border px-3 py-1.5 text-sm"
                disabled={!selectedIds.length || loading}
                onClick={() => void setSeriesFor(selectedIds, 'clear')}
                title="Clear series_id on selected events"
              >
                Clear series
              </button>
            </div>

            {/* Reassign to ANOTHER series */}
            <div className="flex items-center gap-1">
              <label className="text-sm text-neutral-600">Move to series:</label>
              <select
                className="border rounded px-2 py-1 text-sm"
                onChange={(e) => {
                  const target = Number(e.target.value || 0)
                  if (!target) return
                  void reassignSeriesFor(selectedIds, target)
                  e.currentTarget.selectedIndex = 0
                }}
              >
                <option value="">— choose —</option>
                {renderSeriesOptions()}
              </select>
            </div>

            {/* Existing festival bulk selector */}
            <div className="flex items-center gap-1">
              <label className="text-sm text-neutral-600">Assign festival:</label>
              <select
                className="border rounded px-2 py-1 text-sm"
                onChange={(e) => {
                  const v = e.target.value
                  if (!v) return
                  if (v === '__new__') {
                    openCreateFestival()
                  } else if (v === '__clear__') {
                    void assignFestivalTo(selectedIds, null)
                  } else {
                    void assignFestivalTo(selectedIds, v)
                  }
                  e.currentTarget.selectedIndex = 0
                }}
              >
                <option value="">— choose —</option>
                <option value="__clear__">␡ Clear festival</option>
                <option value="__new__">+ New festival…</option>
                {festivals.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.label} ({f.start_date} → {f.end_date})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Festivals list */}
      <section className="card">
        <div className="card-header flex items-center justify-between">
          <b>Festivals in “{series?.name ?? ''}”</b>
          <div className="flex gap-2">
            <button className="rounded-md border px-3 py-1.5 text-sm" onClick={() => void loadFestivals()} disabled={loading}>
              Refresh
            </button>
            <button className="rounded-md border px-3 py-1.5 text-sm" onClick={openCreateFestival}>
              + New festival
            </button>
          </div>
        </div>
        <div className="card-body overflow-x-auto">
          {!festivals.length ? (
            <div className="text-sm text-neutral-600">No festivals yet.</div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th className="text-left">Label</th>
                  <th className="text-left">City</th>
                  <th className="text-left">Dates</th>
                  <th className="text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {festivals.map(f => (
                  <tr key={f.id}>
                    <td>{f.label}</td>
                    <td>{f.city || '—'}</td>
                    <td>{f.start_date} → {f.end_date}</td>
                    <td className="space-x-2">
                      <a
                        className="rounded-md border px-2 py-1 text-sm"
                        href="#"
                        onClick={(e) => { e.preventDefault(); openEditFestival(f) }}
                      >
                        Edit
                      </a>
                      <a
                        className="rounded-md border px-2 py-1 text-sm"
                        href="#"
                        onClick={async (e) => {
                          e.preventDefault()
                          if (!confirm('Delete this festival? All linked events will be unassigned.')) return
                          setErr(null); setOk(null)
                          const r = await fetch('/api/admin/festivals/delete', {
                            method: 'POST',
                            headers: { 'content-type': 'application/json' },
                            body: JSON.stringify({ id: f.id }),
                          })
                          const js = await r.json()
                          if (!r.ok || js.ok === false) { setErr(js?.error || r.statusText); return }
                          setOk(js.message || 'Deleted.')
                          await loadFestivals()
                          await loadResults()
                        }}
                      >
                        Delete
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Results table + pagination */}
      <section className="card">
        <div className="card-header flex items-center justify-between">
          <b>Results</b>
          <div className="flex items-center gap-2 text-sm">
            <button className="rounded-md border px-2 py-1" disabled={!canPrev} onClick={() => canPrev && setPage(p => p - 1)}>
              ← Prev
            </button>
            <span>Page {page} / {pageCount}</span>
            <button className="rounded-md border px-2 py-1" disabled={!canNext} onClick={() => canNext && setPage(p => p + 1)}>
              Next →
            </button>
          </div>
        </div>
        <div className="card-body overflow-x-auto">
          {!results.length ? (
            <div className="text-sm text-neutral-600">{loading ? 'Loading…' : 'No results.'}</div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={results.length > 0 && Object.values(selected).every(Boolean)}
                      onChange={(e) => toggleAll(e.target.checked)}
                    />
                  </th>
                  <th className="text-left">Start</th>
                  <th className="text-left">Tournament</th>
                  <th className="text-left">Festival</th>
                  <th className="text-left">Series</th>
                  <th className="text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {results.map(r => {
                  const isChecked = !!selected[r.id]
                  const currentSeriesId = r.series_id ?? 0
                  return (
                    <tr key={r.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => setSelected(s => ({ ...s, [r.id]: e.target.checked }))}
                        />
                      </td>
                      <td>{r.start_date || '—'}</td>
                      <td title={r.tournament_name || ''}>{r.tournament_name || '—'}</td>
                      <td>
                        <select
                          className="border rounded px-2 py-1 text-sm"
                          value={r.festival_id || 'none'}
                          onChange={(e) => {
                            const v = e.target.value
                            if (v === 'none') {
                              void assignFestivalTo([r.id], null)
                            } else if (v === '__new__') {
                              openCreateFestival()
                            } else {
                              void assignFestivalTo([r.id], v)
                            }
                          }}
                        >
                          <option value="none">— none —</option>
                          {festivals.map(f => (
                            <option key={f.id} value={f.id}>
                              {f.label} ({f.start_date} → {f.end_date})
                            </option>
                          ))}
                          <option value="__new__">+ New…</option>
                        </select>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          {currentSeriesId === seriesId ? (
                            <>
                              <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">In this series</span>
                              <button
                                className="rounded-md border px-2 py-1 text-sm"
                                onClick={() => void setSeriesFor([r.id], 'clear')}
                                disabled={loading}
                              >
                                Remove
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                className="rounded-md border px-2 py-1 text-sm"
                                onClick={() => void setSeriesFor([r.id], 'assign')}
                                disabled={loading}
                                title="Assign to this series"
                              >
                                Add here
                              </button>
                              <select
                                className="border rounded px-2 py-1 text-sm"
                                value=""
                                onChange={(e) => {
                                  const target = Number(e.target.value || 0)
                                  if (!target) return
                                  void reassignSeriesFor([r.id], target)
                                  e.currentTarget.selectedIndex = 0
                                }}
                                title="Move to a different series"
                              >
                                <option value="">Move to…</option>
                                {renderSeriesOptions()}
                              </select>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="space-x-2">
                        <a
                          className="rounded-md border px-2 py-1 text-sm"
                          href={`/#/result/${r.id}`}
                          onClick={(e) => { e.preventDefault(); alert(`Event ${r.id}\n${r.tournament_name || ''}`) }}
                        >
                          View
                        </a>
                        {r.festival_id && (
                          <button
                            className="rounded-md border px-2 py-1 text-sm"
                            onClick={() => void assignFestivalTo([r.id], null)}
                          >
                            Clear festival
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Create/Edit Festival — Modal */}
      <Modal
        open={festModalOpen}
        onClose={closeFestivalModal}
        title={`${festMode === 'edit' ? 'Edit' : 'Create'} festival${series?.name ? ` in “${series.name}”` : ''}`}
      >
        <div className="space-y-4">
          <div className="grid md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label className="block text-sm text-neutral-600">Label</label>
              <input
                ref={firstInputRef}
                className="w-full border rounded px-2 py-1"
                value={festForm.label}
                onChange={(e) => setFestForm({ ...festForm, label: e.target.value })}
                placeholder="e.g. UKPL Liverpool"
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-600">City (optional)</label>
              <input
                className="w-full border rounded px-2 py-1"
                value={festForm.city}
                onChange={(e) => setFestForm({ ...festForm, city: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm text-neutral-600">Start</label>
                <input
                  type="date"
                  className="w-full border rounded px-2 py-1"
                  value={festForm.start_date}
                  onChange={(e) => setFestForm({ ...festForm, start_date: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-600">End</label>
                <input
                  type="date"
                  className="w-full border rounded px-2 py-1"
                  value={festForm.end_date}
                  onChange={(e) => setFestForm({ ...festForm, end_date: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button className="rounded-md border px-3 py-1.5 text-sm" onClick={() => void saveFestival()} disabled={loading}>
              {festMode === 'edit' ? 'Save changes' : 'Create'}
            </button>
            <button className="rounded-md border px-3 py-1.5 text-sm" onClick={closeFestivalModal}>
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
