'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabaseBrowser'

export default function LoginPage() {
  const supabase = createSupabaseBrowserClient()
  const router = useRouter()
  const sp = useSearchParams()
  const next = sp.get('next') || '/admin' // where to send them after login

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function signIn(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true); setErr(null); setMsg(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setErr(error.message)
        return
      }

      // Optional: check admin role immediately so you get a helpful message
      const user = data.user
      const roles = ((user?.app_metadata as any)?.roles ?? []) as string[]
      const isAdmin = roles.includes('admin') || !!(user?.user_metadata as any)?.is_admin

      if (!isAdmin) {
        setMsg('Signed in, but your account is not an admin. Ask an admin to grant access.')
        // Still navigate — middleware may redirect you back to /login if required
      }

      // Navigate; if middleware blocks, you’ll come back to /login
      router.replace(next)
    } catch (e: any) {
      setErr(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-2xl font-semibold">Sign in</h1>

        <form onSubmit={signIn} className="space-y-3">
          <input
            className="w-full border rounded-xl p-3"
            type="email"
            placeholder="you@domain.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            autoFocus
          />
          <input
            className="w-full border rounded-xl p-3"
            type="password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl p-3 bg-black text-white disabled:opacity-60"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {err && <p className="text-sm text-red-600">{err}</p>}
        {msg && <p className="text-sm text-gray-700">{msg}</p>}

        <div className="flex items-center justify-between text-sm">
          <Link href="/signup" className="underline">Create an account</Link>
          <Link href="/auth/reset" className="underline">Forgot password?</Link>
        </div>
      </div>
    </div>
  )
}
