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
    // Sticky header with glass effect
    <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-base-100/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Left: Logo Area */}
        <div className="flex items-center gap-2">
          {/* Replace with <img src="/logo.png" /> if you have one */}
          <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-primary-content font-bold">
            N
          </div>
          <Link href="/" className="text-xl font-bold tracking-tight">
            NPL
          </Link>
        </div>

        {/* Center/Right: Navigation (Uppercase) */}
        <nav className="hidden md:flex items-center gap-8">
          <Link href="/leaderboards" className="text-sm font-semibold uppercase tracking-wider text-base-content/80 hover:text-primary transition-colors">
            Leaderboards
          </Link>
          <Link href="/events" className="text-sm font-semibold uppercase tracking-wider text-base-content/80 hover:text-primary transition-colors">
            Tournaments
          </Link>
          <Link href="/players" className="text-sm font-semibold uppercase tracking-wider text-base-content/80 hover:text-primary transition-colors">
            Players
          </Link>
          <Link href="/news" className="text-sm font-semibold uppercase tracking-wider text-base-content/80 hover:text-primary transition-colors">
            News
          </Link>
          {isAdmin && (
            <Link href="/admin" className="text-sm font-semibold uppercase tracking-wider text-error">
              Admin
            </Link>
          )}
        </nav>

        {/* Far Right: CTA */}
        <div className="flex items-center gap-4">
          {email ? (
            <form action="/logout" method="post">
              <button className="btn btn-ghost btn-sm uppercase font-semibold">Log out</button>
            </form>
          ) : (
            <Link href="/login" className="btn btn-primary btn-sm uppercase font-bold px-6">
              Login / Register
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}