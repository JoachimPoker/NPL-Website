'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabaseBrowser'
import { isAdminUser } from '@/lib/isAdmin'

/** The main menu on wide screens: the sections people come for, in the order they use them. */
const LINKS = [
  { label: 'Leaderboards', href: '/leaderboards' },
  { label: 'Tournaments', href: '/events' },
  { label: 'Players', href: '/players' },
  { label: 'Hall of Fame', href: '/hall-of-fame' },
  { label: 'Badges', href: '/badges' },
  { label: 'News', href: '/news' },
  { label: 'About', href: '/about' },
]

/** The phone menu has room for everything, grouped like the footer. */
const GROUPS: { title: string; links: { label: string; href: string }[] }[] = [
  { title: 'League', links: [{ label: 'Leaderboards', href: '/leaderboards' }, { label: 'Hall of Fame', href: '/hall-of-fame' }, { label: 'Badges', href: '/badges' }, { label: 'About the league', href: '/about' }] },
  { title: 'Results', links: [{ label: 'Tournaments', href: '/events' }, { label: 'Venues', href: '/venues' }, { label: 'News', href: '/news' }] },
  { title: 'Players', links: [{ label: 'All players', href: '/players' }, { label: 'Compare players', href: '/compare' }] },
]

/** Who's signed in, read in the browser so pages stay cacheable. Only decides which links show: /admin is guarded in src/proxy.ts. */
function useAccount() {
  const [account, setAccount] = useState({ signedIn: false, isAdmin: false })
  useEffect(() => {
    const { data: sub } = createSupabaseBrowserClient().auth.onAuthStateChange((_event, session) => {
      setAccount({ signedIn: !!session, isAdmin: isAdminUser(session?.user) })
    })
    return () => sub.subscription.unsubscribe()
  }, [])
  return account
}

export default function SiteNav() {
  const { isAdmin, signedIn } = useAccount()
  const pathname = usePathname()
  // The menu is open for the page it was opened on, so moving to another page closes it.
  const [openOn, setOpenOn] = useState<string | null>(null)
  const open = openOn === pathname
  const setOpen = (fn: (o: boolean) => boolean) => setOpenOn(fn(open) ? pathname : null)

  const links = isAdmin ? [...LINKS, { label: 'Admin', href: '/admin' }] : LINKS
  const groups = isAdmin ? [...GROUPS, { title: 'Staff', links: [{ label: 'Admin', href: '/admin' }] }] : GROUPS
  // The Players menu item covers profiles and Compare too; Tournaments covers venues.
  const isActive = (href: string) =>
    pathname === href ||
    pathname.startsWith(`${href}/`) ||
    (href === '/players' && pathname.startsWith('/compare')) ||
    (href === '/events' && pathname.startsWith('/venues'))

  const account = signedIn ? (
    <form action="/logout" method="post">
      <button className="inline-flex h-10 items-center rounded-[3px] px-3 text-[0.9375rem] font-medium text-white/75 transition-colors hover:bg-white/[0.06] hover:text-white">
        Log out
      </button>
    </form>
  ) : null // only admins sign in; the link lives in the footer

  return (
    <>
      <nav aria-label="Main" className="hidden flex-1 items-center justify-end gap-6 lg:flex">
        <ul className="flex items-center gap-5 xl:gap-8">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={isActive(l.href) ? 'page' : undefined}
                className={`relative block py-2 text-[0.95rem] font-medium tracking-[0.01em] transition-colors xl:text-[1.0625rem] ${
                  isActive(l.href) ? 'text-white' : 'text-white/85 hover:text-white'
                }`}
              >
                {l.label}
                {isActive(l.href) && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-season-amber" aria-hidden="true" />}
              </Link>
            </li>
          ))}
        </ul>
        {account}
      </nav>

      <button
        type="button"
        className="inline-flex size-11 items-center justify-center rounded-[3px] text-white transition-colors hover:bg-white/[0.06] lg:hidden"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
      </button>

      {open && (
        <div id="mobile-menu" className="absolute inset-x-0 top-[5.75rem] max-h-[calc(100dvh-5.75rem)] overflow-y-auto border-b border-white/[0.08] bg-season-night lg:hidden">
          <nav aria-label="Main" className="grid gap-6 px-4 pb-6 pt-4 sm:grid-cols-3 sm:px-[3.6vw]">
            {groups.map((g) => (
              <div key={g.title}>
                <p className="mb-1 px-3 text-[0.875rem] font-medium text-season-muted">{g.title}</p>
                <ul>
                  {g.links.map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        aria-current={pathname === l.href || pathname.startsWith(`${l.href}/`) ? 'page' : undefined}
                        className={`flex min-h-12 items-center rounded-[3px] px-3 text-[1.125rem] font-medium ${
                          pathname === l.href || pathname.startsWith(`${l.href}/`) ? 'bg-season-card text-white' : 'text-white/85 hover:bg-white/[0.04]'
                        }`}
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {account && <div className="border-t border-white/[0.08] pt-4 sm:col-span-3">{account}</div>}
          </nav>
        </div>
      )}
    </>
  )
}
