// src/app/login/page.tsx
'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabaseBrowser';

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
      const roles = ((user?.app_metadata as any)?.roles ?? []) as string[];
      const isAdmin = roles.includes('admin') || !!(user?.user_metadata as any)?.is_admin;

      if (!isAdmin) {
        setMsg('Signed in, but your account is not an admin. Ask an admin to grant access.');
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
      <section className="card bg-base-100 shadow-xl">
        <div className="card-body space-y-4">
          <div>
            <h1 className="text-2xl font-semibold">Sign in</h1>
            <p className="text-sm text-base-content/70 mt-1">
              Use your admin account to access the dashboard.
            </p>
          </div>

          <form onSubmit={signIn} className="space-y-3">
            <div className="form-control">
              <label className="label">
                <span className="label-text text-sm">Email</span>
              </label>
              <input
                className="input input-bordered w-full"
                type="email"
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text text-sm">Password</span>
              </label>
              <input
                className="input input-bordered w-full"
                type="password"
                placeholder="Your password"
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
            <Link href="/signup" className="link link-hover">
              Create an account
            </Link>
            <Link href="/auth/reset" className="link link-hover">
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
    <main className="min-h-screen flex items-center justify-center bg-base-200 p-4">
      <Suspense fallback={<div className="p-4 text-center">Loading login...</div>}>
        <LoginContent />
      </Suspense>
    </main>
  );
}