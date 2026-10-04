import Image from "next/image";

/**
 * The frame for sign-in, sign-up and password pages: a dim still of the card room behind one quiet card.
 * The photo is a generated stand-in (no real people).
 */
export function AuthShell({ title, lede, children }: { title: string; lede?: string; children: React.ReactNode }) {
  return (
    <div className="relative isolate flex flex-1 items-center justify-center overflow-hidden bg-season-night px-4 py-[clamp(3rem,8vw,6rem)] font-season text-season-ink">
      <Image src="/events/hero-floor.png" alt="" fill sizes="100vw" className="-z-10 object-cover object-[60%_40%] opacity-35" />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_40%,rgb(6_25_28/0.55),var(--color-season-night)_75%)]" />
      <section className="w-full max-w-[26rem] border border-white/[0.1] bg-[linear-gradient(180deg,#0f3337_0%,#0a2427_100%)] p-[clamp(1.5rem,4vw,2.25rem)]">
        <h1 className="text-[clamp(1.75rem,2.6vw,2.25rem)] font-bold leading-tight tracking-[-0.01em]">{title}</h1>
        {lede && <p className="mt-2 text-[0.9375rem] leading-relaxed text-season-muted">{lede}</p>}
        <div className="mt-6">{children}</div>
      </section>
    </div>
  );
}

/** A labelled text field in the season style. */
export function Field({ label, ...input }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[0.9375rem] font-medium text-season-ink/85">{label}</span>
      <input
        {...input}
        className="h-12 w-full rounded-[3px] border border-white/[0.14] bg-season-night/60 px-4 text-[1rem] text-season-ink caret-season-amber placeholder:text-season-muted/80 transition-colors hover:border-white/25 focus:border-season-amber/60 focus:outline-none focus-visible:outline-2 focus-visible:outline-season-amber"
      />
    </label>
  );
}

/** The one amber action on the card. */
export function Submit({ busy, children, busyLabel }: { busy: boolean; children: React.ReactNode; busyLabel: string }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-[3px] bg-season-amber px-5 text-[1rem] font-semibold text-season-amber-ink transition-colors hover:bg-[#f6b45a] disabled:cursor-wait disabled:opacity-70"
    >
      {busy ? busyLabel : children}
    </button>
  );
}

/** A message under the form: problems in red, everything else calm. Announced to screen readers. */
export function Notice({ kind, children }: { kind: "error" | "info" | "success"; children: React.ReactNode }) {
  const tone =
    kind === "error"
      ? "border-season-down/50 bg-season-down/[0.08] text-[#ffb3b1]"
      : kind === "success"
        ? "border-season-up/50 bg-season-up/[0.08] text-[#a6e9c6]"
        : "border-white/[0.14] bg-white/[0.04] text-season-ink/90";
  return (
    <p role={kind === "error" ? "alert" : "status"} className={`mt-4 rounded-[3px] border px-4 py-3 text-[0.9375rem] leading-relaxed ${tone}`}>
      {children}
    </p>
  );
}

export const authLink = "inline-flex min-h-11 items-center text-[0.9375rem] text-season-ink/80 underline decoration-season-ink/25 underline-offset-4 hover:text-season-ink hover:decoration-season-ink";
