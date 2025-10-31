'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabaseBrowser'

export default function Providers({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseBrowserClient()
  const router = useRouter()

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event) => {
      // any auth change → refresh data
      router.refresh()
    })
    return () => sub.subscription.unsubscribe()
  }, [supabase, router])

  return <>{children}</>
}
