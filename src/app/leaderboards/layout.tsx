import { pageMeta } from "@/lib/site";

export const metadata = pageMeta({
  title: "Leaderboards",
  description: "NPL, High Roller and Low Roller leaderboards for every season, plus the all-time leaderboard.",
  path: "/leaderboards",
});

export default function LeaderboardsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
