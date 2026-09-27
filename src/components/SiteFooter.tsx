import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'

const GROUPS: { title: string; links: [string, string][] }[] = [
  { title: 'League', links: [['Leaderboards', '/leaderboards'], ['Hall of Fame', '/hall-of-fame'], ['Badges', '/badges']] },
  { title: 'Results', links: [['Tournaments', '/events'], ['Venues', '/venues'], ['News', '/news']] },
  { title: 'Players', links: [['All players', '/players'], ['Compare players', '/compare']] },
  { title: 'Series', links: [['GUKPT', '/events/gukpt'], ['Goliath', '/events/goliath'], ['UK Open', '/events/uk-open'], ['Behemoth', '/events/behemoth']] },
]

export default function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-16 border-t border-base-content/[0.07] bg-base-300/40">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-10 px-4 py-14 sm:grid-cols-4 sm:px-6 lg:grid-cols-[1.6fr_repeat(4,1fr)] lg:px-8">
        <div className="col-span-2 space-y-5 sm:col-span-4 lg:col-span-1">
          <Link href="/" aria-label="Home" className="inline-block">
            <Logo className="h-12 w-auto" />
          </Link>
          <p className="max-w-xs text-sm leading-relaxed text-base-content/60">
            Standings, results and player records from every National Poker League event, updated after each weekly report.
          </p>
          <Link href="/leaderboards" className="btn btn-primary btn-sm">See the leaderboards</Link>
        </div>
        {GROUPS.map((g) => (
          <nav key={g.title} aria-label={g.title}>
            <h2 className="eyebrow mb-4">{g.title}</h2>
            <ul className="space-y-2.5 text-sm">
              {g.links.map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="text-base-content/70 transition-colors hover:text-primary">{label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-base-content/[0.07] bg-base-300/60">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-5 text-xs text-base-content/55 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>
            <span className="mr-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-base-content/30 text-[10px] font-bold text-base-content">18+</span>
            Please play responsibly ·{' '}
            <a href="https://www.gambleaware.org" className="underline underline-offset-4 hover:text-base-content">GambleAware.org</a>
          </p>
          <p>
            © {year} National Poker League · <Link href="/login" className="hover:text-base-content">Admin</Link>
          </p>
        </div>
      </div>
    </footer>
  )
}
