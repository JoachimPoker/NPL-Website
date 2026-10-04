import Link from "next/link";
import { LEGAL, LEGAL_LINKS } from "@/lib/legal";

/**
 * The frame for the legal and help pages: a plain reading column (no photo band), the title and when it was
 * last updated, the text, and links to the other legal pages.
 */
export function LegalPage({ title, lede, path, children }: { title: string; lede?: string; path: string; children: React.ReactNode }) {
  return (
    <div className="bg-season-night font-season text-season-ink">
      <article className="mx-auto w-full max-w-[46rem] px-4 pb-[clamp(3rem,5vw,4.5rem)] pt-[clamp(2rem,4vw,3.5rem)] sm:px-6">
        <h1 className="text-[clamp(2.25rem,4vw,3.5rem)] font-bold leading-[1.06] tracking-[-0.012em]">{title}</h1>
        {lede && <p className="mt-3 text-[clamp(1.0625rem,1.4vw,1.25rem)] leading-relaxed text-season-ink/85">{lede}</p>}
        <p className="mt-2 text-[0.9375rem] text-season-muted">Last updated {LEGAL.lastUpdated}</p>
        <div className="legal-body mt-8 space-y-4 text-[1.0625rem] leading-[1.7] text-season-ink/85">{children}</div>
        <nav aria-label="Legal" className="mt-12 border-t border-white/[0.1] pt-5">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[0.9375rem]">
            {LEGAL_LINKS.filter((l) => l.href !== path).map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-season-ink/80 underline decoration-season-ink/25 underline-offset-4 hover:text-season-ink hover:decoration-season-ink">{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </article>
    </div>
  );
}

/** A section heading inside a legal page. */
export function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="!mt-10 text-[clamp(1.375rem,1.8vw,1.625rem)] font-semibold leading-tight text-season-ink">{children}</h2>;
}

/** An inline link in legal text. */
export function A({ href, children }: { href: string; children: React.ReactNode }) {
  const external = /^https?:/.test(href);
  return external ? (
    <a href={href} className="font-medium text-season-ink underline decoration-season-ink/30 underline-offset-4 hover:decoration-season-ink" rel="noopener noreferrer" target="_blank">
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  ) : (
    <Link href={href} className="font-medium text-season-ink underline decoration-season-ink/30 underline-offset-4 hover:decoration-season-ink">{children}</Link>
  );
}

/** A bulleted list in legal text. */
export function UL({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-6 marker:text-season-muted">{children}</ul>;
}

/** Who runs the site, from the settings: only the details that have been filled in. */
export function Operator() {
  const bits = [
    LEGAL.operatorName,
    LEGAL.companyNumber && `Company number ${LEGAL.companyNumber}`,
    LEGAL.registeredAddress && `Registered office: ${LEGAL.registeredAddress}`,
    LEGAL.icoRegistration && `ICO registration ${LEGAL.icoRegistration}`,
  ].filter(Boolean);
  if (!bits.length) return null;
  return <p>{bits.join(" · ")}</p>;
}
