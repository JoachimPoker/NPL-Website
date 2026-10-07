import { createSupabasePublicClient } from "@/lib/supabasePublic";
import { ogCard, OG_SIZE, gbpOg } from "@/lib/og";
import { day } from "@/lib/tournaments";

export const size = OG_SIZE;
export const alt = "Tournament result";
export const contentType = "image/png";
export const revalidate = 3600;
// None built ahead: each image is drawn on first request, then served from cache.
export function generateStaticParams() {
  return [];
}

export default async function Image(props: { params: Promise<{ id: string }> }) {
  const supabase = createSupabasePublicClient();
  const { data: ev } = await supabase.from("event_summary").select("*").eq("id", Number((await props.params).id)).maybeSingle();
  if (!ev) return ogCard({ eyebrow: "Tournaments", title: "Tournament not found" });

  return ogCard({
    eyebrow: [ev.casino, day(ev.start_date, { day: "numeric", month: "short", year: "numeric" })].filter(Boolean).join(" · "),
    title: ev.name ?? "Tournament",
    subtitle: ev.winner_name ? `Won by ${ev.winner_name}` : null,
    stats: [
      { label: "Buy-in", value: ev.buy_in ? gbpOg(Number(ev.buy_in)) : "Free" },
      { label: "Cashes", value: String(ev.entries) },
      { label: "Paid out", value: gbpOg(Number(ev.paid_out || 0)) },
      { label: "First prize", value: ev.winner_prize ? gbpOg(Number(ev.winner_prize)) : "–" },
    ],
  });
}
