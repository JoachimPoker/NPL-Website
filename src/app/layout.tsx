// src/app/layout.tsx
import './globals.css'
import { Inter } from 'next/font/google'
import { headers } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export const runtime = 'nodejs'

export const metadata = {
  title: 'National Poker League',
  description: 'Official leaderboards and player stats.',
  icons: { icon: '/favicon.ico' },
}

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full bg-neutral-50">
      <body className={`${inter.className} min-h-full text-neutral-900 antialiased`}>
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  )
}

// ---- Shell (server component) ----
async function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Container className="py-6 space-y-6">{children}</Container>
      </main>
      <SiteFooter />
    </div>
  )
}

// ---- Shared primitives ----
function Container({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={`mx-auto w-full max-w-6xl px-4 sm:px-6 ${className}`}>{children}</div>
}

async function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/80">
      <Container className="py-3">
        <div className="flex items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-2 font-semibold">
            <div className="h-8 w-8 rounded-lg bg-black text-white grid place-items-center text-sm dark:bg-white dark:text-black">
              N
            </div>
            National Poker League
          </a>
          {/* dynamic nav */}
          <Nav />
        </div>
      </Container>
    </header>
  )
}

// Dynamic nav (server component)
async function Nav() {
  // ✅ use read-only Supabase client in Server Component
  const supabase = await createSupabaseServerClient({ mode: 'readonly' })
  const { data } = await supabase.auth.getUser().catch(() => ({ data: { user: null } as any }))
  const user = data?.user ?? null

  const roles: string[] = (user?.app_metadata?.roles ?? []) as any
  const isAdmin =
    roles?.includes?.('admin') ||
    user?.app_metadata?.role === 'admin' ||
    user?.user_metadata?.is_admin === true

  const h = await headers()
  const pathname =
    h.get('next-url') || h.get('x-invoke-path') || h.get('x-matched-path') || '/'

  const on = (p: string) => pathname === p || pathname.startsWith(p + '/')

  const link = (href: string, label: string) => (
    <a
      href={href}
      className={`text-sm hover:underline ${
        on(href) ? 'font-semibold underline' : 'text-neutral-700 dark:text-neutral-300'
      }`}
    >
      {label}
    </a>
  )

  return (
    <nav className="flex items-center gap-4">
      {link('/leaderboards', 'Leaderboards')}
      {link('/events', 'Events')}
      {link('/players', 'Players')}
      {isAdmin && link('/admin', 'Admin')}

      {user ? (
        // Sign out must be a POST → use a small form styled like a link
        <form action="/auth/signout" method="post">
          <button className="text-sm text-neutral-700 hover:underline dark:text-neutral-300">
            Log out
          </button>
        </form>
      ) : (
        link('/login', 'Log in')
      )}
    </nav>
  )
}

function SiteFooter() {
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <Container className="py-6 text-xs text-neutral-500">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>© {new Date().getFullYear()} National Poker League</div>
          <div className="flex items-center gap-4">
            <a className="hover:underline" href="/leaderboards">
              Leaderboards
            </a>
            <a className="hover:underline" href="/players">
              Players
            </a>
            <a className="hover:underline" href="/privacy">
              Privacy
            </a>
          </div>
        </div>
      </Container>
    </footer>
  )
}
