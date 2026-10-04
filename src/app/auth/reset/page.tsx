'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabaseBrowser'
import { AuthShell, Field, Notice, Submit, authLink } from '@/components/auth/AuthShell'

function ResetPasswordContent() {
  const supabase = createSupabaseBrowserClient()
  const [email, setEmail] = useState('')
  const [newPw, setNewPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [hasSessionFromRecovery, setHasSessionFromRecovery] = useState(false)

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
    setMsg('If that email has an account, a reset link is on its way. Check your inbox and spam folder.')
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
    setMsg('Password updated. You can now sign in with your new password.')
  }

  if (hasSessionFromRecovery) {
    return (
      <AuthShell title="Set a new password">
        <form onSubmit={updatePassword} className="space-y-4">
          <Field label="New password" type="password" placeholder="At least 6 characters" value={newPw} onChange={(e) => setNewPw(e.target.value)} required minLength={6} autoComplete="new-password" />
          <Submit busy={busy} busyLabel="Updating…">Update password</Submit>
        </form>
        {err && <Notice kind="error">{err}</Notice>}
        {msg && <Notice kind="success">{msg}</Notice>}
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Reset your password" lede="Enter your account email and we’ll send you a link to choose a new password.">
      <form onSubmit={sendReset} className="space-y-4">
        <Field label="Email" type="email" placeholder="you@domain.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        <Submit busy={busy} busyLabel="Sending…">Send reset link</Submit>
      </form>
      {err && <Notice kind="error">{err}</Notice>}
      {msg && <Notice kind="info">{msg}</Notice>}
      <p className="mt-4">
        <Link href="/login" className={authLink}>Back to sign in</Link>
      </p>
    </AuthShell>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center bg-season-night p-10 text-season-muted">Loading…</div>}>
      <ResetPasswordContent />
    </Suspense>
  )
}
