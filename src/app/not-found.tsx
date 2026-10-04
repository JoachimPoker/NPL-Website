import ErrorScreen from "@/components/ErrorScreen";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <ErrorScreen
      code="404"
      title="We couldn't find that page"
      body="The link may be old, or the player, event or page may have moved. The leaderboards and the players list are good places to start."
      primary={{ label: "Go to the leaderboards", href: "/leaderboards" }}
      secondary={{ label: "Find a player", href: "/players" }}
    />
  );
}
