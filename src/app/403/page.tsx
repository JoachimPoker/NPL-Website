// src/app/403/page.tsx
import Link from "next/link";

export default function Forbidden() {
  return (
    <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <div className="eyebrow">Admin only</div>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">You don&apos;t have access</h1>
      <p className="mt-2 text-base-content/60">
        You&apos;re signed in, but your account doesn&apos;t have admin rights. Ask an admin to grant them.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Link href="/" className="btn btn-primary btn-sm">
          Go to homepage
        </Link>
        <Link href="/leaderboards" className="btn btn-ghost btn-sm">
          View leaderboards
        </Link>
      </div>
    </div>
  );
}
