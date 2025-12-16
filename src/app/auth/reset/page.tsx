'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabaseBrowser'

export default function ResetPasswordPage() {
  const supabase = createSupabaseBrowserClient()
  const sp = useSearchParams()
  const mode = sp.get('mode') // 'request' | 'update' (we'll infer)
  const [email, setEmail] = useState('')
  const [newPw, setNewPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [hasSessionFromRecovery, setHasSessionFromRecovery] = useState(false)

  // If user lands here from Supabase recovery link, they arrive with a session.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasSessionFromRecovery(!!data.session)
    })
  }, [supabase])

  async function sendReset(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setMsg(null)
    setBusy(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/reset`,
    })
    setBusy(false)
    if (error) {
      setErr(error.message)
      return
    }
    setMsg('Check your email for a reset link.')
  }

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setMsg(null)
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: newPw })
    setBusy(false)
    if (error) {
      setErr(error.message)
      return
    }
    setMsg('Password updated. You can close this tab and sign in.')
  }

  // If user has an active recovery session: set new password
  if (hasSessionFromRecovery) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body space-y-4">
              <h1 className="card-title text-2xl">Set a new password</h1>

              <form onSubmit={updatePassword} className="space-y-3">
                <input
                  className="input input-bordered w-full"
                  type="password"
                  placeholder="New password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  className="btn btn-primary w-full"
                  disabled={busy}
                  type="submit"
                >
                  {busy ? 'Updating…' : 'Update password'}
                </button>
              </form>

              {err && (
                <div role="alert" className="alert alert-error text-sm">
                  <span>{err}</span>
                </div>
              )}
              {msg && (
                <div role="alert" className="alert alert-success text-sm">
                  <span>{msg}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Request reset link
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body space-y-4">
            <h1 className="card-title text-2xl">Reset password</h1>

            <form onSubmit={sendReset} className="space-y-3">
              <input
                className="input input-bordered w-full"
                type="email"
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <button
                className="btn btn-primary w-full"
                disabled={busy}
                type="submit"
              >
                {busy ? 'Sending…' : 'Send reset link'}
              </button>
            </form>

            {err && (
              <div role="alert" className="alert alert-error text-sm">
                <span>{err}</span>
              </div>
            )}
            {msg && (
              <div role="alert" className="alert alert-info text-sm">
                <span>{msg}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
