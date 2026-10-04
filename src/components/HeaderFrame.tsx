'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'

/**
 * The site header's frame. On pages that open with a hero photograph it lies transparently over it
 * (the photo is the first thing you see); everywhere else it is a solid sticky bar.
 */
const OVER_HERO = new Set(['/', '/leaderboards', '/events', '/players', '/compare', '/hall-of-fame', '/venues', '/news', '/badges', '/about'])
const isOverHero = (path: string) =>
  OVER_HERO.has(path) || /^\/(players|venues)\/[^/]+$/.test(path) || /^\/events\/[^/]+(\/[^/]+)?$/.test(path)

export default function HeaderFrame({ children }: { children: ReactNode }) {
  const overHero = isOverHero(usePathname())
  return (
    <header
      className={
        overHero
          ? 'absolute inset-x-0 top-0 z-50 w-full'
          : 'sticky top-0 z-50 w-full border-b border-white/[0.07] bg-season-night/90 backdrop-blur-md'
      }
    >
      {children}
    </header>
  )
}
