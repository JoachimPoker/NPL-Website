import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { isAdminUser } from '@/lib/isAdmin'
import SiteNav from '@/components/SiteNav'
import { Logo } from '@/components/brand/Logo'

export const dynamic = 'force-dynamic'

export default async function SiteHeader() {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  const user = data?.user
  const email = user?.email ?? null
  const isAdmin = isAdminUser(user)

  return (
    <header className="sticky top-0 z-50 w-full border-b border-base-content/[0.07] bg-base-200/85 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="shrink-0" aria-label="National Poker League, home">
          <Logo className="h-9 w-auto sm:h-11" />
        </Link>

        <SiteNav isAdmin={isAdmin} signedIn={!!email} />
      </div>
    </header>
  )
}
