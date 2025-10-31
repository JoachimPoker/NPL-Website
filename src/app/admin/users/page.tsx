'use client'

import { useEffect, useState } from 'react'

type U = {
  id: string
  email: string | null
  app_metadata?: any
  user_metadata?: any
  created_at?: string
  last_sign_in_at?: string | null
}

export default function AdminUsersPage() {
  const [list, setList] = useState<U[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  async function load() {
    setLoading(true); setErr(null); setOk(null)
    try {
      const res = await fetch('/api/admin/users/list', { cache: 'no-store' })
      const js = await res.json()
      if (!res.ok) throw new Error(js?._error || res.statusText)
      setList(js.users || [])
    } catch (e:any) {
      setErr(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function setRoles(user_id: string, roles: string[]) {
    setLoading(true); setErr(null); setOk(null)
    try {
      const res = await fetch('/api/admin/users/set-role', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ user_id, roles }),
      })
      const js = await res.json()
      if (!res.ok) throw new Error(js?._error || res.statusText)
      setOk('Updated roles.')
      load()
    } catch (e:any) {
      setErr(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Admin — Users</h1>
        <button className="border rounded px-3 py-1" onClick={load} disabled={loading}>Refresh</button>
      </div>

      {err && <div className="p-2 rounded bg-red-100 text-red-700 text-sm">{err}</div>}
      {ok && <div className="p-2 rounded bg-green-100 text-green-700 text-sm">{ok}</div>}

      <div className="border rounded bg-white overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="text-left">Email</th>
              <th className="text-left">Roles</th>
              <th className="text-left">Last sign-in</th>
              <th className="text-left w-56">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map(u => {
              const roles: string[] = ((u.app_metadata?.roles) ?? []) as string[]
              const isAdmin = roles.includes('admin')
              return (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>{roles.length ? roles.join(', ') : '—'}</td>
                  <td>{u.last_sign_in_at ?? '—'}</td>
                  <td className="space-x-2">
                    <button
                      className="border rounded px-2 py-1"
                      onClick={() => setRoles(u.id, Array.from(new Set([...roles, 'admin'])))}
                      disabled={loading || isAdmin}
                      title={isAdmin ? 'Already admin' : 'Grant admin'}
                    >
                      Make admin
                    </button>
                    <button
                      className="border rounded px-2 py-1"
                      onClick={() => setRoles(u.id, roles.filter(r => r !== 'admin'))}
                      disabled={loading || !isAdmin}
                      title={!isAdmin ? 'Not an admin' : 'Remove admin'}
                    >
                      Remove admin
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
