'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabaseBrowser'

export default function Providers({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseBrowserClient()
  const router = useRouter()

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      // Signing in or out → refresh data. Not on INITIAL_SESSION (fires on every page load)
      // or TOKEN_REFRESHED, which would re-render each page on the server for nothing.
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') router.refresh()
    })
    return () => sub.subscription.unsubscribe()
  }, [supabase, router])

  return <>{children}</>
}
