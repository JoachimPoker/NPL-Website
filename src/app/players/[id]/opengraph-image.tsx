import { getCareer } from "@/lib/career";
import { ogCard, OG_SIZE, gbpOg } from "@/lib/og";

export const size = OG_SIZE;
export const alt = "Player profile";
export const contentType = "image/png";
export const revalidate = 3600;
// None built ahead: each image is drawn on first request, then served from cache.
export function generateStaticParams() {
  return [];
}

export default async function Image(props: { params: Promise<{ id: string }> }) {
  const career = await getCareer(Number((await props.params).id));
  if (!career) return ogCard({ eyebrow: "Players", title: "Player not found" });

  // Name is already masked to initials for players without GDPR consent.
  const { player, totals, seasons } = career;
  const current = seasons.find((s) => s.active);
  const npl = current?.leagues.npl;
  return ogCard({
    eyebrow: "Player profile",
    title: player.name,
    subtitle: npl ? `${current!.name}: #${npl.position} in the NPL with ${npl.points.toFixed(2)} points` : null,
    stats: [
      { label: "Cashes", value: totals.cashes.toLocaleString("en-GB") },
      { label: "Wins", value: String(totals.wins) },
      { label: "Final tables", value: String(totals.final_tables) },
      { label: "Winnings", value: gbpOg(totals.money) },
    ],
  });
}
