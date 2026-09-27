// src/app/login/page.tsx
'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabaseBrowser';
import { isAdminUser } from '@/lib/isAdmin';

// 1. Logic Component (not exported as default)
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

      const user = data.user;
      const isAdmin = isAdminUser(user);

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
    <div className="w-full max-w-md">
      <section className="panel">
        <div className="space-y-5 p-7 sm:p-8">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Sign in</h1>
            <p className="text-sm text-base-content/70 mt-1">
              Use your admin account to access the dashboard.
            </p>
          </div>

          <form onSubmit={signIn} className="space-y-3">
            <div className="space-y-1.5">
              <span className="block text-sm font-medium text-base-content/75">Email</span>
              <input
                className="input w-full"
                type="email"
                placeholder="you@domain.com"
                aria-label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <span className="block text-sm font-medium text-base-content/75">Password</span>
              <input
                className="input w-full"
                type="password"
                placeholder="Your password"
                aria-label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="btn btn-primary w-full mt-2 disabled:opacity-60"
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {err && (
            <div className="alert alert-error py-2 text-sm">
              <span>{err}</span>
            </div>
          )}
          {msg && (
            <div className="alert alert-info py-2 text-sm">
              <span>{msg}</span>
            </div>
          )}

          <div className="flex items-center justify-between text-sm pt-2">
            <Link href="/signup" className="text-base-content/70 hover:text-primary">
              Create an account
            </Link>
            <Link href="/auth/reset" className="text-base-content/70 hover:text-primary">
              Forgot password?
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

// 2. Default Export (Wrapper)
export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <Suspense fallback={<div className="p-10 text-center text-base-content/50">Loading…</div>}>
        <LoginContent />
      </Suspense>
    </div>
  );
}