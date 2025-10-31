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
    setErr(null); setMsg(null); setBusy(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/reset`,
    })
    setBusy(false)
    if (error) { setErr(error.message); return }
    setMsg('Check your email for a reset link.')
  }

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault()
    setErr(null); setMsg(null); setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: newPw })
    setBusy(false)
    if (error) { setErr(error.message); return }
    setMsg('Password updated. You can close this tab and sign in.')
  }

  // Decide which form to show
  if (hasSessionFromRecovery) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          <h1 className="text-2xl font-semibold">Set a new password</h1>
          <form onSubmit={updatePassword} className="space-y-3">
            <input
              className="w-full border rounded-xl p-3"
              type="password"
              placeholder="New password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              required
              minLength={6}
            />
            <button className="w-full rounded-xl p-3 bg-black text-white disabled:opacity-60" disabled={busy}>
              {busy ? 'Updating…' : 'Update password'}
            </button>
          </form>
          {err && <p className="text-sm text-red-600">{err}</p>}
          {msg && <p className="text-sm text-green-700">{msg}</p>}
        </div>
      </div>
    )
  }

  // Request link
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-2xl font-semibold">Reset password</h1>
        <form onSubmit={sendReset} className="space-y-3">
          <input
            className="w-full border rounded-xl p-3"
            type="email"
            placeholder="you@domain.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button className="w-full rounded-xl p-3 bg-black text-white disabled:opacity-60" disabled={busy}>
            {busy ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
        {err && <p className="text-sm text-red-600">{err}</p>}
        {msg && <p className="text-sm text-gray-700">{msg}</p>}
      </div>
    </div>
  )
}
