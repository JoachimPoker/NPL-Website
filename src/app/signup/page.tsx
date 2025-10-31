'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabaseBrowser'

export default function SignupPage() {
  const supabase = createSupabaseBrowserClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  async function signUp(e: React.FormEvent) {
    e.preventDefault()
    setErr(null); setMsg(null)
    if (password !== confirm) {
      setErr('Passwords do not match.')
      return
    }
    setBusy(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      // optional: initialize flags for your app
      options: { data: { is_admin: false } },
    })
    setBusy(false)
    if (error) { setErr(error.message); return }
    setMsg('Account created. You can sign in now.')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-2xl font-semibold">Create account</h1>

        <form onSubmit={signUp} className="space-y-3">
          <input
            className="w-full border rounded-xl p-3"
            type="email"
            placeholder="you@domain.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="w-full border rounded-xl p-3"
            type="password"
            placeholder="Choose a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <input
            className="w-full border rounded-xl p-3"
            type="password"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={6}
          />
          <button
            disabled={busy}
            className="w-full rounded-xl p-3 bg-black text-white disabled:opacity-60"
          >
            {busy ? 'Creating…' : 'Create account'}
          </button>
        </form>

        {err && <p className="text-sm text-red-600">{err}</p>}
        {msg && <p className="text-sm text-green-700">{msg}</p>}

        <div className="text-sm">
          Already have an account? <Link href="/login" className="underline">Sign in</Link>
        </div>
      </div>
    </div>
  )
}
