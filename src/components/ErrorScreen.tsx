import Image from "next/image";
import Link from "next/link";

type Action = { label: string; href?: string; onClick?: () => void };

/**
 * A full-page message (not found, no access, something broke): a dim card-room still, a large quiet code,
 * the plain explanation and the ways forward. The photo is a generated stand-in (no real people).
 */
export default function ErrorScreen({ code, title, body, primary, secondary }: { code: string; title: string; body: string; primary: Action; secondary?: Action }) {
  const btn = "inline-flex h-12 items-center rounded-[3px] bg-season-amber px-5 text-[1rem] font-semibold text-season-amber-ink transition-colors hover:bg-[#f6b45a]";
  const link = "inline-flex min-h-11 items-center text-[1rem] font-medium text-season-ink/85 underline decoration-season-ink/25 underline-offset-4 hover:text-season-ink hover:decoration-season-ink";
  const render = (a: Action, cls: string) =>
    a.href ? <Link href={a.href} className={cls}>{a.label}</Link> : <button type="button" onClick={a.onClick} className={cls}>{a.label}</button>;

  return (
    <div className="relative isolate flex flex-1 items-center overflow-hidden bg-season-night px-4 py-[clamp(4rem,10vw,8rem)] font-season text-season-ink sm:px-[3.6vw]">
      <Image src="/leaderboards/hero-hall.png" alt="" fill sizes="100vw" className="-z-10 object-cover object-[65%_50%] opacity-40" />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-season-night via-season-night/80 to-season-night/40" />
      <div className="max-w-[36rem]" role={code === "Error" ? "alert" : undefined}>
        <p aria-hidden="true" className="text-[clamp(4rem,9vw,7.5rem)] font-bold leading-none tracking-[-0.02em] text-season-amber/90 tabular-nums">{code}</p>
        <h1 className="mt-3 text-[clamp(1.75rem,3vw,2.75rem)] font-bold leading-tight tracking-[-0.01em]">{title}</h1>
        <p className="mt-3 text-[clamp(1.0625rem,1.3vw,1.25rem)] leading-relaxed text-season-ink/80">{body}</p>
        <div className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-3">
          {render(primary, btn)}
          {secondary && render(secondary, link)}
        </div>
      </div>
    </div>
  );
}
