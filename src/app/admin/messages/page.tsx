import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { deleteMessageAction, purgeOldMessagesAction, setMessageHandledAction } from "./actions";

export const dynamic = "force-dynamic";

type Message = {
  id: string; created_at: string; topic: string; name: string; email: string;
  player_link: string | null; message: string; handled_at: string | null; handled_by: string | null;
};

const TOPIC: Record<string, string> = {
  privacy: "Name / initials request",
  correction: "Correction",
  accessibility: "Accessibility",
  other: "Other",
};
const when = (d: string) => new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
/** Data requests must be answered within a month. */
const due = (d: string) => new Date(new Date(d).getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export default async function AdminMessagesPage(props: { searchParams: Promise<{ show?: string }> }) {
  const show = (await props.searchParams).show === "done" ? "done" : "open";
  const db = await createSupabaseServerClient();
  let q = db.from("contact_messages" as any).select("*").order("created_at", { ascending: show === "open" });
  q = show === "open" ? q.is("handled_at", null) : q.not("handled_at", "is", null);
  const { data, error } = await q.limit(200);
  const messages = (data || []) as unknown as Message[];

  return (
    <div className="space-y-[clamp(2rem,3.5vw,3rem)] px-4 py-[clamp(1.75rem,3vw,2.75rem)] sm:px-[3.6vw]">
      <div>
        <h1 className="text-[clamp(2rem,3.2vw,3rem)] font-bold leading-[1.04] tracking-[-0.012em]">Messages</h1>
        <p className="mt-2 max-w-[52em] text-[1.0625rem] text-season-muted">
          From the contact form. Reply by email from your own inbox. Name and initials requests are data requests: answer them within a month, and set the
          player to initials under Players.
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded-[3px] border border-season-down/50 bg-season-down/[0.08] px-4 py-3 text-[0.9375rem] text-[#ffb3b1]">
          Messages aren&apos;t set up in the database yet. Run the migration <code>20261004150000_contact_messages.sql</code> in Supabase, then reload this page.
        </p>
      ) : (
        <section aria-labelledby="list">
          <h2 id="list" className="sr-only">{show === "open" ? "Messages to deal with" : "Messages dealt with"}</h2>
          <nav aria-label="Show" className="flex flex-wrap items-center gap-4">
            <div className="inline-flex rounded-[3px] border border-white/[0.12]">
              {[
                { key: "open", label: "To deal with", href: "/admin/messages" },
                { key: "done", label: "Dealt with", href: "/admin/messages?show=done" },
              ].map((t) => (
                <Link
                  key={t.key}
                  href={t.href}
                  aria-current={show === t.key ? "page" : undefined}
                  className={`-m-px flex h-11 items-center rounded-[3px] px-[1.1rem] text-[0.9375rem] font-medium ${
                    show === t.key ? "relative z-10 bg-season-amber/[0.12] font-semibold shadow-[inset_0_0_0_1px_var(--color-season-amber)]" : "text-season-ink/75 hover:text-season-ink"
                  }`}
                >
                  {t.label}
                </Link>
              ))}
            </div>
            {show === "done" && (
              <form action={purgeOldMessagesAction}>
                <button className="btn btn-sm">Delete messages dealt with over 12 months ago</button>
              </form>
            )}
          </nav>

          {messages.length === 0 ? (
            <p className="mt-6 text-[1.0625rem] text-season-ink/80">{show === "open" ? "Nothing waiting. New messages from the contact form appear here." : "No messages dealt with yet."}</p>
          ) : (
            <ul className="mt-5 space-y-3">
              {messages.map((m) => (
                <li key={m.id} className="border border-white/[0.08] bg-[linear-gradient(180deg,#0f3337_0%,#0a2427_100%)] p-4 sm:p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                    <p className="text-[1.0625rem] font-semibold">
                      {TOPIC[m.topic] ?? m.topic} <span className="font-normal text-season-muted">from {m.name}</span>
                    </p>
                    <p className="text-[0.875rem] text-season-muted">
                      {when(m.created_at)}
                      {m.topic === "privacy" && !m.handled_at && <span className="ml-2 text-season-amber">answer by {due(m.created_at)}</span>}
                    </p>
                  </div>
                  <p className="mt-1 text-[0.9375rem]">
                    <a href={`mailto:${m.email}`} className="text-season-ink underline decoration-season-ink/30 underline-offset-4">{m.email}</a>
                    {m.player_link && (
                      <>
                        {" · "}
                        <a href={m.player_link.startsWith("http") || m.player_link.startsWith("/") ? m.player_link : `/${m.player_link}`} className="text-season-ink underline decoration-season-ink/30 underline-offset-4" rel="noopener noreferrer" target="_blank">
                          linked page
                        </a>
                      </>
                    )}
                  </p>
                  <p className="mt-3 whitespace-pre-line text-[1rem] leading-relaxed text-season-ink/90">{m.message}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <form action={setMessageHandledAction}>
                      <input type="hidden" name="id" value={m.id} />
                      <input type="hidden" name="handled" value={m.handled_at ? "0" : "1"} />
                      <button className={`btn btn-sm ${m.handled_at ? "" : "btn-primary"}`}>{m.handled_at ? "Reopen" : "Mark as dealt with"}</button>
                    </form>
                    <form action={deleteMessageAction}>
                      <input type="hidden" name="id" value={m.id} />
                      <button className="btn btn-ghost btn-sm">Delete</button>
                    </form>
                    {m.handled_at && <span className="text-[0.875rem] text-season-muted">Dealt with {when(m.handled_at)}{m.handled_by ? ` by ${m.handled_by}` : ""}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
