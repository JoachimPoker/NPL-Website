'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'

const LINKS = [
  { label: 'Leaderboards', href: '/leaderboards' },
  { label: 'Tournaments', href: '/events' },
  { label: 'Players', href: '/players' },
  { label: 'Badges', href: '/badges' },
  { label: 'Hall of Fame', href: '/hall-of-fame' },
  { label: 'News', href: '/news' },
]

export default function SiteNav({ isAdmin, signedIn }: { isAdmin: boolean; signedIn: boolean }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // Close the mobile menu whenever the route changes.
  useEffect(() => setOpen(false), [pathname])

  const links = isAdmin ? [...LINKS, { label: 'Admin', href: '/admin' }] : LINKS
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  const account = signedIn ? (
    <form action="/logout" method="post">
      <button className="btn btn-ghost btn-sm font-medium text-base-content/70">Log out</button>
    </form>
  ) : null // only admins sign in; the link lives in the footer

  return (
    <>
      <nav aria-label="Main" className="hidden flex-1 items-center justify-end gap-6 lg:flex">
        <ul className="flex items-center gap-5 lg:gap-7">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={isActive(l.href) ? 'page' : undefined}
                className={`relative block py-2 text-sm font-semibold uppercase tracking-wide transition-colors ${
                  isActive(l.href) ? 'text-base-content' : 'text-base-content/60 hover:text-base-content'
                }`}
              >
                {l.label}
                {isActive(l.href) && <span className="absolute inset-x-0 bottom-0.5 h-0.5 rounded-full bg-primary" />}
              </Link>
            </li>
          ))}
        </ul>
        {account}
      </nav>

      <button
        type="button"
        className="btn btn-ghost btn-sm btn-square lg:hidden"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {open && (
        <div className="absolute inset-x-0 top-20 border-b border-base-content/[0.07] bg-base-200 shadow-2xl lg:hidden">
          <nav aria-label="Main" className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={isActive(l.href) ? 'page' : undefined}
                className={`rounded-lg px-3 py-3 text-base font-semibold uppercase tracking-wide ${
                  isActive(l.href) ? 'bg-base-100 text-primary' : 'text-base-content/80'
                }`}
              >
                {l.label}
              </Link>
            ))}
            {account && <div className="mt-3 border-t border-base-content/[0.07] pt-4">{account}</div>}
          </nav>
        </div>
      )}
    </>
  )
}
