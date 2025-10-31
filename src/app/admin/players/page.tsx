'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

type Player = {
  id: string
  display_name: string
  forename?: string | null
  surname?: string | null
  avatar_url?: string | null
  bio?: string | null
  created_at?: string
  updated_at?: string
}

type ListResp = { ok?: boolean; players?: Player[]; total?: number; page?: number; limit?: number; error?: string }
type Alias = { id: string; player_id: string; alias: string; alias_norm?: string | null; created_at: string }
type AliasesResp = { ok?: boolean; aliases?: Alias[]; error?: string }

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
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-3xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-semibold">{title || 'Modal'}</h2>
          <button className="rounded-md border px-2 py-1 text-sm" onClick={onClose}>✕</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

export default function AdminPlayersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [q, setQ] = useState(searchParams.get('q') ?? '')
  const [page, setPage] = useState<number>(Number(searchParams.get('page') || 1) || 1)
  const [limit, setLimit] = useState<number>(Number(searchParams.get('limit') || 50) || 50)

  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const [players, setPlayers] = useState<Player[]>([])
  const [total, setTotal] = useState(0)

  // modal
  type Mode = 'create' | 'edit'
  const [modalOpen, setModalOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('create')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<{ display_name: string; forename: string; surname: string; avatar_url: string; bio: string }>({
    display_name: '',
    forename: '',
    surname: '',
    avatar_url: '',
    bio: '',
  })

  // aliases
  const [aliases, setAliases] = useState<Alias[]>([])
  const [newAlias, setNewAlias] = useState<string>('')

  const pageCount = Math.max(1, Math.ceil(total / limit))
  const canPrev = page > 1
  const canNext = page < pageCount

  async function load() {
    setLoading(true); setErr(null)
    try {
      const params = new URLSearchParams()
      if (q.trim()) params.set('q', q.trim())
      params.set('page', String(page))
      params.set('limit', String(limit))
      const r = await fetch('/api/admin/players/list?' + params.toString(), { cache: 'no-store' })
      const js: ListResp = await r.json()
      if (!r.ok || js.ok === false) throw new Error(js.error || r.statusText)
      setPlayers(js.players || [])
      setTotal(js.total || 0)
    } catch (e: any) {
      setErr(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])
  useEffect(() => {
    const sp = new URLSearchParams()
    if (q.trim()) sp.set('q', q.trim())
    if (page !== 1) sp.set('page', String(page))
    if (limit !== 50) sp.set('limit', String(limit))
    router.replace(sp.size ? `/admin/players?${sp.toString()}` : '/admin/players')
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, page, limit])

  async function loadAliases(pid: string) {
    const r = await fetch(`/api/admin/players/aliases/list?player_id=${encodeURIComponent(pid)}`, { cache: 'no-store' })
    const js: AliasesResp = await r.json()
    if (!r.ok || js.ok === false) throw new Error(js.error || r.statusText)
    setAliases(js.aliases || [])
  }

  function openCreate() {
    setMode('create')
    setEditingId(null)
    setForm({ display_name: '', forename: '', surname: '', avatar_url: '', bio: '' })
    setAliases([])
    setNewAlias('')
    setModalOpen(true)
  }

  async function openEdit(p: Player) {
    setMode('edit')
    setEditingId(p.id)
    setForm({
      display_name: p.display_name || '',
      forename: p.forename || '',
      surname: p.surname || '',
      avatar_url: p.avatar_url || '',
      bio: p.bio || '',
    })
    setModalOpen(true)
    try { await loadAliases(p.id) } catch (e: any) { setErr(e?.message || String(e)) }
  }

  function closeModal() {
    setModalOpen(false)
    setEditingId(null)
    setAliases([])
    setNewAlias('')
  }

  async function savePlayer() {
    setErr(null); setOk(null)
    const payload = {
      display_name: form.display_name.trim(),
      forename: form.forename.trim() || null,
      surname: form.surname.trim() || null,
      avatar_url: form.avatar_url.trim() || null,
      bio: form.bio.trim() || null,
    }
    if (!payload.display_name) { setErr('Display name is required'); return }

    if (mode === 'create') {
      const r = await fetch('/api/admin/players/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const js = await r.json()
      if (!r.ok || js.ok === false) { setErr(js.error || r.statusText); return }
      setOk('Player created.')
    } else if (editingId) {
      const r = await fetch('/api/admin/players/update', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: editingId, ...payload }),
      })
      const js = await r.json()
      if (!r.ok || js.ok === false) { setErr(js.error || r.statusText); return }
      setOk('Player updated.')
    }

    closeModal()
    await load()
  }

  async function deletePlayer(id: string) {
    if (!confirm('Delete this player?')) return
    setErr(null); setOk(null)
    const r = await fetch('/api/admin/players/delete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const js = await r.json()
    if (!r.ok || js.ok === false) { setErr(js.error || r.statusText); return }
    setOk('Deleted.')
    await load()
  }

  async function addAlias() {
    const v = newAlias.trim()
    if (!editingId || !v) return
    const r = await fetch('/api/admin/players/aliases/add', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ player_id: editingId, alias: v }),
    })
    const js = await r.json()
    if (!r.ok || js.ok === false) { setErr(js.error || r.statusText); return }
    setNewAlias('')
    await loadAliases(editingId)
  }

  async function removeAlias(id: string) {
    if (!confirm('Remove this alias?')) return
    const r = await fetch('/api/admin/players/aliases/delete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const js = await r.json()
    if (!r.ok || js.ok === false) { setErr(js.error || r.statusText); return }
    if (editingId) await loadAliases(editingId)
  }

  return (
    <div className="space-y-6">
      <section className="card">
        <div className="card-header flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Admin — Players</h1>
          <div className="flex items-center gap-2">
            <a className="rounded-md border px-3 py-1.5 text-sm" href="/admin">Dashboard</a>
            <button className="rounded-md border px-3 py-1.5 text-sm" onClick={openCreate}>+ New player</button>
          </div>
        </div>
        <div className="card-body">
          <div className="grid md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-sm text-neutral-600">Search players</label>
              <input
                className="w-full border rounded px-2 py-1"
                placeholder="Name, bio…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && load()}
              />
            </div>
            <div className="flex items-end gap-3">
              <label className="text-sm inline-flex items-center gap-2">
                Page size:
                <select className="border rounded px-2 py-1 text-sm" value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1) }}>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </label>
              <button className="rounded-md border px-3 py-1.5 text-sm" onClick={() => void load()} disabled={loading}>
                Refresh
              </button>
            </div>
          </div>
          {err && <div className="mt-3 p-2 rounded bg-red-100 text-red-700 text-sm">{err}</div>}
          {ok && <div className="mt-3 p-2 rounded bg-green-100 text-green-700 text-sm">{ok}</div>}
        </div>
      </section>

      <section className="card">
        <div className="card-header flex items-center justify-between">
          <b>Players</b>
          <div className="flex items-center gap-2 text-sm">
            <button className="rounded-md border px-2 py-1" disabled={!canPrev} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span>Page {page} / {Math.max(1, Math.ceil(total / limit))}</span>
            <button className="rounded-md border px-2 py-1" disabled={!canNext} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        </div>
        <div className="card-body overflow-x-auto">
          {!players.length ? (
            <div className="text-sm text-neutral-600">{loading ? 'Loading…' : 'No players found.'}</div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th className="text-left">Display name</th>
                  <th className="text-left">Forename</th>
                  <th className="text-left">Surname</th>
                  <th className="text-left">Avatar</th>
                  <th className="text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {players.map(p => (
                  <tr key={p.id}>
                    <td>{p.display_name}</td>
                    <td>{p.forename || '—'}</td>
                    <td>{p.surname || '—'}</td>
                    <td>{p.avatar_url ? <a className="text-blue-600 underline" href={p.avatar_url} target="_blank">open</a> : '—'}</td>
                    <td className="space-x-2">
                      <a className="rounded-md border px-2 py-1 text-sm" href="#" onClick={(e) => { e.preventDefault(); void openEdit(p) }}>
                        Edit
                      </a>
                      <a className="rounded-md border px-2 py-1 text-sm" href="#" onClick={(e) => { e.preventDefault(); void deletePlayer(p.id) }}>
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

      <Modal open={modalOpen} onClose={closeModal} title={mode === 'edit' ? 'Edit player' : 'Create player'}>
        <div className="space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-neutral-600">Display name</label>
              <input
                className="w-full border rounded px-2 py-1"
                value={form.display_name}
                onChange={(e) => setForm(s => ({ ...s, display_name: e.target.value }))}
                placeholder="e.g. Jane Doe"
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-600">Forename</label>
              <input className="w-full border rounded px-2 py-1" value={form.forename} onChange={(e) => setForm(s => ({ ...s, forename: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm text-neutral-600">Surname</label>
              <input className="w-full border rounded px-2 py-1" value={form.surname} onChange={(e) => setForm(s => ({ ...s, surname: e.target.value }))} />
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm text-neutral-600">Avatar URL</label>
              <input className="w-full border rounded px-2 py-1" value={form.avatar_url} onChange={(e) => setForm(s => ({ ...s, avatar_url: e.target.value }))} placeholder="https://…" />
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm text-neutral-600">Bio</label>
              <textarea className="w-full border rounded px-2 py-1" rows={3} value={form.bio} onChange={(e) => setForm(s => ({ ...s, bio: e.target.value }))} />
            </div>
          </div>

          {mode === 'edit' && editingId && (
            <div className="border rounded-md p-3">
              <div className="flex items-center justify-between mb-2">
                <b>Aliases</b>
              </div>
              {!aliases.length ? (
                <div className="text-sm text-neutral-500 mb-2">No aliases yet.</div>
              ) : (
                <ul className="list-disc pl-5 mb-2">
                  {aliases.map(a => (
                    <li key={a.id} className="flex items-center gap-2">
                      <span>{a.alias}</span>
                      <button className="text-xs rounded border px-2 py-0.5" onClick={() => void removeAlias(a.id)}>Remove</button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex items-center gap-2">
                <input className="border rounded px-2 py-1" placeholder="Add alias" value={newAlias} onChange={(e) => setNewAlias(e.target.value)} />
                <button className="rounded-md border px-3 py-1.5 text-sm" onClick={() => void addAlias()}>Add</button>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button className="rounded-md border px-3 py-1.5 text-sm" onClick={() => void savePlayer()}>
              {mode === 'edit' ? 'Save changes' : 'Create'}
            </button>
            <button className="rounded-md border px-3 py-1.5 text-sm" onClick={closeModal}>Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
