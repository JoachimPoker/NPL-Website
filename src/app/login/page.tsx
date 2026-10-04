// src/app/login/page.tsx
'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabaseBrowser';
import { isAdminUser } from '@/lib/isAdmin';
import { AuthShell, Field, Notice, Submit, authLink } from '@/components/auth/AuthShell';

function LoginContent() {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get('next') || '/admin';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr(null);
    setMsg(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setErr(error.message);
        return;
      }

      const isAdmin = isAdminUser(data.user);

      // Admin pages are the only thing behind a login, so don't bounce non-admins to the 403 page.
      if (!isAdmin && next.startsWith('/admin')) {
        setMsg('Signed in, but this account is not an admin yet. Ask an admin to grant access.');
        return;
      }

      router.replace(next);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Sign in" lede="For league staff: sign in with your admin account to manage results and content.">
      <form onSubmit={signIn} className="space-y-4">
        <Field label="Email" type="email" placeholder="you@domain.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" autoFocus />
        <Field label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        <Submit busy={busy} busyLabel="Signing in…">Sign in</Submit>
      </form>

      {err && <Notice kind="error">{err}</Notice>}
      {msg && <Notice kind="info">{msg}</Notice>}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4">
        <Link href="/auth/reset" className={authLink}>Forgot password? Set or reset it</Link>
      </div>
      <p className="mt-2 text-[0.875rem] text-season-muted">There&apos;s no public sign-up: an admin adds new staff accounts.</p>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center bg-season-night p-10 text-season-muted">Loading…</div>}>
      <LoginContent />
    </Suspense>
  );
}
