import { ogCard, OG_SIZE, OG_ALT } from "@/lib/og";

export const size = OG_SIZE;
export const alt = OG_ALT;
export const contentType = "image/png";

export default async function Image() {
  return ogCard({
    eyebrow: "Season standings · results · players",
    title: "Every result, every champion",
    subtitle: "League tables, tournament results, badges and player stats for the National Poker League.",
  });
}
