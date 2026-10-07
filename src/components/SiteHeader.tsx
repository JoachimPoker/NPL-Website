import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import { Logo } from '@/components/brand/Logo'
import HeaderFrame from '@/components/HeaderFrame'

// No login check here: reading the session cookie on the server would stop every page from
// being cached. SiteNav checks it in the browser to show the Admin link and Log out.
export default function SiteHeader() {
  return (
    <HeaderFrame>
      <div className="flex h-[5.75rem] items-center justify-between gap-8 px-4 font-season sm:px-[3.6vw]">
        <Link href="/" className="shrink-0" aria-label="National Poker League, home">
          <Logo className="h-9 w-auto sm:h-[3.25rem]" />
        </Link>

        <SiteNav />
      </div>
    </HeaderFrame>
  )
}
