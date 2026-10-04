"use client";

import { useActionState, useState } from "react";
import { type ContactState, sendContactAction } from "./actions";

const TOPICS = [
  { value: "privacy", label: "Show me by initials, or remove my name" },
  { value: "correction", label: "A result or name is wrong" },
  { value: "accessibility", label: "Something on the site doesn't work for me" },
  { value: "other", label: "Something else" },
];

const field =
  "w-full rounded-[3px] border border-white/[0.14] bg-season-night/60 px-4 text-[1rem] text-season-ink caret-season-amber placeholder:text-season-muted/80 transition-colors hover:border-white/25 focus:border-season-amber/60 focus:outline-none focus-visible:outline-2 focus-visible:outline-season-amber";
const label = "mb-1.5 block text-[0.9375rem] font-medium text-season-ink/85";

export default function ContactForm({ initialTopic }: { initialTopic?: string }) {
  const [state, action, pending] = useActionState<ContactState, FormData>(sendContactAction, { ok: false });
  const [startedAt] = useState(() => Date.now());
  const f = state.fields ?? {};

  if (state.ok) {
    return (
      <p role="status" className="rounded-[3px] border border-season-up/50 bg-season-up/[0.08] px-5 py-4 text-[1.0625rem] text-[#a6e9c6]">
        Thanks, your message has been sent. We&apos;ll reply by email, usually within a few days and always within a month for data requests.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="started_at" value={startedAt} />
      {/* Left empty by people; bots tend to fill it. */}
      <div aria-hidden="true" className="hidden">
        <label>
          Website <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <fieldset>
        <legend className={label}>What is it about?</legend>
        <div className="space-y-2">
          {TOPICS.map((t) => (
            <label key={t.value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[3px] border border-white/[0.1] px-4 has-[:checked]:border-season-amber/70 has-[:checked]:bg-season-amber/[0.08]">
              <input type="radio" name="topic" value={t.value} defaultChecked={(f.topic || initialTopic || "other") === t.value} className="size-4 accent-[var(--color-season-amber)]" />
              <span className="text-[1rem]">{t.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className={label}>Your name</span>
          <input name="name" required autoComplete="name" defaultValue={f.name} className={`${field} h-12`} />
        </label>
        <label className="block">
          <span className={label}>Email, so we can reply</span>
          <input name="email" type="email" required autoComplete="email" defaultValue={f.email} className={`${field} h-12`} />
        </label>
      </div>

      <label className="block">
        <span className={label}>
          Link to the player or event <span className="font-normal text-season-muted">(optional)</span>
        </span>
        <input name="player_link" type="text" inputMode="url" placeholder="Paste the page address" defaultValue={f.player_link} className={`${field} h-12`} />
      </label>

      <label className="block">
        <span className={label}>Message</span>
        <textarea name="message" required rows={6} maxLength={4000} defaultValue={f.message} className={`${field} py-3 leading-relaxed`} />
      </label>

      {state.error && (
        <p role="alert" className="rounded-[3px] border border-season-down/50 bg-season-down/[0.08] px-4 py-3 text-[0.9375rem] text-[#ffb3b1]">
          {state.error}
        </p>
      )}

      <p className="text-[0.875rem] text-season-muted">
        We use your details only to reply and act on your message, and delete them 12 months after. See the{" "}
        <a href="/privacy" className="text-season-ink underline decoration-season-ink/30 underline-offset-4">privacy notice</a>.
      </p>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 items-center rounded-[3px] bg-season-amber px-6 text-[1rem] font-semibold text-season-amber-ink transition-colors hover:bg-[#f6b45a] disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
