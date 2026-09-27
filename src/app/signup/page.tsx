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
    setErr(null)
    setMsg(null)

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

    if (error) {
      setErr(error.message)
      return
    }

    setMsg('Account created. You can sign in now.')
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="panel">
          <div className="space-y-5 p-7 sm:p-8">
            <h1 className="font-display text-3xl font-semibold tracking-tight">Create account</h1>

            <form onSubmit={signUp} className="space-y-3">
              <input
                className="input w-full"
                type="email"
                placeholder="you@domain.com"
                aria-label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <input
                className="input w-full"
                type="password"
                placeholder="Choose a password"
                aria-label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
              <input
                className="input w-full"
                type="password"
                placeholder="Confirm password"
                aria-label="Confirm password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />

              <button
                disabled={busy}
                className="btn btn-primary w-full"
                type="submit"
              >
                {busy ? 'Creating…' : 'Create account'}
              </button>
            </form>

            {err && (
              <p className="text-sm text-error">
                {err}
              </p>
            )}
            {msg && (
              <p className="text-sm text-success">
                {msg}
              </p>
            )}

            <div className="text-sm flex items-center justify-between pt-2">
              <span className="text-base-content/70">
                Already have an account?
              </span>
              <Link href="/login" className="text-base-content/70 hover:text-primary">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
