"use client";

// Shown when a page fails to load, instead of a blank screen.
import { useEffect } from "react";
import ErrorScreen from "@/components/ErrorScreen";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorScreen
      code="Error"
      title="This page didn't load"
      body="Something went wrong on our side while loading it. Trying again usually works within a minute."
      primary={{ label: "Try again", onClick: reset }}
      secondary={{ label: "Home page", href: "/" }}
    />
  );
}
