import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { isAdminUser } from '@/lib/isAdmin'
import SiteNav from '@/components/SiteNav'
import { Logo } from '@/components/brand/Logo'
import HeaderFrame from '@/components/HeaderFrame'

export const dynamic = 'force-dynamic'

export default async function SiteHeader() {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  const user = data?.user
  const email = user?.email ?? null
  const isAdmin = isAdminUser(user)

  return (
    <HeaderFrame>
      <div className="flex h-[5.75rem] items-center justify-between gap-8 px-4 font-season sm:px-[3.6vw]">
        <Link href="/" className="shrink-0" aria-label="National Poker League, home">
          <Logo className="h-9 w-auto sm:h-[3.25rem]" />
        </Link>

        <SiteNav isAdmin={isAdmin} signedIn={!!email} />
      </div>
    </HeaderFrame>
  )
}
