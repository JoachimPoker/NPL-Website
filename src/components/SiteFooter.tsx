import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { TERMS_DOCS } from '@/lib/leagueTerms'
import { LEGAL_LINKS } from '@/lib/legal'

const GROUPS: { title: string; links: [string, string][] }[] = [
  { title: 'League', links: [['About the league', '/about'], ['Leaderboards', '/leaderboards'], ['Hall of Fame', '/hall-of-fame'], ['Badges', '/badges']] },
  { title: 'Results', links: [['Tournaments', '/events'], ['Venues', '/venues'], ['News', '/news']] },
  { title: 'Players', links: [['All players', '/players'], ['Compare players', '/compare']] },
]

/** Every active series, in the admin's order (the catch-all "Others" left out), so new series appear here by themselves. */
async function seriesLinks(): Promise<[string, string][]> {
  try {
    const db = await createSupabaseServerClient()
    const { data } = await db.from('series').select('name, slug').eq('is_active', true).neq('slug', 'others').order('sort_order')
    return (data || []).map((s) => [s.name, `/events/${s.slug}`])
  } catch {
    return []
  }
}

export default async function SiteFooter() {
  const year = new Date().getFullYear()
  const series = await seriesLinks()

  return (
    <footer className="border-t border-white/[0.07] bg-[#041214] font-season text-season-ink">
      <div className="grid grid-cols-2 gap-10 px-4 py-14 sm:grid-cols-4 sm:px-[3.6vw] lg:grid-cols-[1.4fr_repeat(3,1fr)_1.6fr]">
        <div className="col-span-2 space-y-5 sm:col-span-4 lg:col-span-1">
          <Link href="/" aria-label="Home" className="inline-block">
            <Logo className="h-12 w-auto" />
          </Link>
          <p className="max-w-xs text-[1rem] leading-relaxed text-season-muted">
            Standings, results and player records from every National Poker League event, updated after each weekly report.
          </p>
        </div>
        {GROUPS.map((g) => (
          <nav key={g.title} aria-label={g.title}>
            <h2 className="mb-4 text-[0.8125rem] font-bold uppercase tracking-[0.18em] text-season-muted">{g.title}</h2>
            <ul className="space-y-1">
              {g.links.map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="inline-flex min-h-9 items-center text-[1rem] text-white/85 transition-colors hover:text-white">{label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
        {series.length > 0 && (
          <nav aria-label="Series" className="col-span-2 sm:col-span-1">
            <h2 className="mb-4 text-[0.8125rem] font-bold uppercase tracking-[0.18em] text-season-muted">Series</h2>
            {/* Two columns: there are a dozen series and the list grows. */}
            <ul className="grid grid-cols-2 gap-x-6 gap-y-1">
              {series.map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="inline-flex min-h-9 items-center text-[1rem] text-white/85 transition-colors hover:text-white">{label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
      <div className="border-t border-white/[0.07]">
        <nav aria-label="Legal" className="px-4 pt-5 sm:px-[3.6vw]">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[0.9375rem]">
            {LEGAL_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-white/85 underline decoration-white/25 underline-offset-4 hover:text-white hover:decoration-white">{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex flex-col gap-3 px-4 py-5 text-[0.9375rem] text-season-muted xl:flex-row xl:items-center xl:justify-between sm:px-[3.6vw]">
          <p className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/40 text-[0.6875rem] font-bold text-white">18+</span>
            Please play responsibly ·{' '}
            <a href="https://www.gambleaware.org" className="text-white underline decoration-white/40 underline-offset-4 hover:decoration-white">GambleAware.org</a>
          </p>
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            {TERMS_DOCS.map((d) => (
              <a key={d.href} href={d.href} className="hover:text-white">
                {d.label.replace(' T&Cs', '')} terms
              </a>
            ))}
          </p>
          <p>
            © {year} National Poker League · <Link href="/login" className="hover:text-white">Admin</Link>
          </p>
        </div>
      </div>
    </footer>
  )
}
