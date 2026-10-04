// src/app/403/page.tsx
import ErrorScreen from "@/components/ErrorScreen";

export default function Forbidden() {
  return (
    <ErrorScreen
      code="403"
      title="You don't have access to this"
      body="You're signed in, but your account doesn't have admin rights yet. Ask an existing admin to grant them."
      primary={{ label: "Go to the leaderboards", href: "/leaderboards" }}
      secondary={{ label: "Home page", href: "/" }}
    />
  );
}
