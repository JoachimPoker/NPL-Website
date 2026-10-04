'use server'

import { createSupabaseServerClient } from "@/lib/supabaseServer";

export type ContactState = { ok: boolean; error?: string; fields?: Record<string, string> };

const TOPICS = ["privacy", "correction", "accessibility", "other"] as const;

/** Save a contact message for the admins. A hidden field and a minimum fill time keep simple bots out. */
export async function sendContactAction(_prev: ContactState, formData: FormData): Promise<ContactState> {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const fields = { topic: get("topic"), name: get("name"), email: get("email"), player_link: get("player_link"), message: get("message") };

  // Bots fill the hidden "website" field and submit instantly; pretend it worked.
  const startedAt = Number(get("started_at"));
  if (get("website") || (startedAt && Date.now() - startedAt < 2500)) return { ok: true };

  if (!TOPICS.includes(fields.topic as (typeof TOPICS)[number])) return { ok: false, error: "Choose what your message is about.", fields };
  if (!fields.name) return { ok: false, error: "Enter your name.", fields };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) return { ok: false, error: "Enter a valid email address, so we can reply.", fields };
  if (fields.message.length < 5) return { ok: false, error: "Write a short message so we know what you need.", fields };
  if (fields.message.length > 4000) return { ok: false, error: "Your message is too long: keep it under 4,000 characters.", fields };

  const db = await createSupabaseServerClient();
  const { error } = await db.from("contact_messages" as any).insert({
    topic: fields.topic,
    name: fields.name.slice(0, 120),
    email: fields.email.slice(0, 200),
    player_link: fields.player_link ? fields.player_link.slice(0, 300) : null,
    message: fields.message,
  });
  if (error) {
    console.error("[contact] insert failed", error);
    return { ok: false, error: "Your message couldn't be sent just now. Please try again in a few minutes.", fields };
  }
  return { ok: true };
}
