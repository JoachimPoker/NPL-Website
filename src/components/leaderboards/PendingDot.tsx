"use client";

import { useLinkStatus } from "next/link";

/**
 * Put inside a <Link>: a small pulsing dot while that link's page is loading, so switching
 * season, league or page shows it registered the tap. Announced to screen readers too.
 * `corner` pins the dot to the top right, for square icon buttons (the link must be `relative`).
 */
export default function PendingDot({ corner = false }: { corner?: boolean }) {
  const { pending } = useLinkStatus();
  return (
    <>
      {pending && (
        <span
          className={`h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-current ${corner ? "absolute right-1.5 top-1.5" : "ml-1.5 inline-block"}`}
          aria-hidden="true"
        />
      )}
      {/* Always mounted: a live region that appears already filled is often not announced. */}
      <span className="sr-only" role="status">
        {pending ? "Loading" : ""}
      </span>
    </>
  );
}
