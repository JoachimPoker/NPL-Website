import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { ogCard, OG_SIZE, gbpOg } from "@/lib/og";
import { dateRange } from "@/lib/tournaments";

export const size = OG_SIZE;
export const alt = "Festival results";
export const contentType = "image/png";
export const revalidate = 3600;

export default async function Image(props: { params: Promise<{ festivalId: string }> }) {
  const supabase = await createSupabaseServerClient();
  const { data: f } = await supabase.from("festival_summary").select("*").eq("id", (await props.params).festivalId).maybeSingle();
  if (!f) return ogCard({ eyebrow: "Tournaments", title: "Festival not found" });

  return ogCard({
    eyebrow: [f.casino, dateRange(f.start_date, f.end_date)].filter(Boolean).join(" · "),
    title: f.label.replace(/\s·\s\w{3}\s\d{4}$/, ""),
    subtitle: f.main_event_winner ? `Main Event won by ${f.main_event_winner}` : null,
    stats: [
      { label: "Events", value: String(f.events) },
      { label: "Cashes", value: f.entries.toLocaleString("en-GB") },
      { label: "Paid out", value: gbpOg(Number(f.paid_out || 0)) },
    ],
  });
}
