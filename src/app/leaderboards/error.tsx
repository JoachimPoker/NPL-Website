"use client";

// src/app/leaderboards/error.tsx
// Shown when the standings can't be loaded, instead of an empty table that looks like "no results".
import Link from "next/link";
import { useEffect } from "react";

export default function LeaderboardsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="bg-season-night px-4 pb-24 pt-40 text-center font-season text-season-ink" role="alert">
      <div className="mx-auto max-w-md">
      <h1 className="text-[clamp(1.75rem,2.4vw,2.25rem)] font-semibold leading-tight">We couldn&apos;t load the leaderboards</h1>
      <p className="mt-3 text-[1.0625rem] text-season-ink/80">
        The standings didn&apos;t come through this time. This usually clears up within a minute.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
        <button type="button" onClick={reset} className="inline-flex h-[2.95rem] items-center rounded-[3px] bg-season-amber px-[1.4rem] font-semibold text-season-amber-ink transition-colors hover:bg-[#f6b45a]">
          Try again
        </button>
        <Link href="/" className="inline-flex min-h-11 items-center font-medium text-season-ink/80 hover:text-season-ink">
          Back to the home page
        </Link>
      </div>
      </div>
    </div>
  );
}
