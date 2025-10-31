// Renders Login / Logout and Admin link (admins only)
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

export default async function SiteHeader() {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  const user = data?.user
  const email = user?.email ?? null
  const roles = ((user?.app_metadata as any)?.roles ?? []) as string[]
  const isAdmin = roles.includes('admin') || !!(user?.user_metadata as any)?.is_admin

  return (
    <header className="w-full border-b bg-white">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-semibold">NPL</Link>

        <nav className="flex items-center gap-3 text-sm">
          {/* Public nav links can go here */}
          {isAdmin && <Link href="/admin" className="underline">Admin</Link>}

          {email ? (
            <form action="/logout" method="post">
              <button className="rounded border px-3 py-1.5" type="submit">Log out</button>
            </form>
          ) : (
            <Link href="/login" className="rounded border px-3 py-1.5">Log in</Link>
          )}
        </nav>
      </div>
    </header>
  )
}
