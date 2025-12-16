// src/app/403/page.tsx
import Link from "next/link";

export default function Forbidden() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="card max-w-xl bg-base-100 shadow-sm">
        <div className="card-body items-center space-y-3 text-center">
          <h1 className="card-title text-2xl font-semibold">Forbidden</h1>
          <p className="text-base-content/70">
            You’re signed in, but your account doesn’t have admin access.
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <Link href="/" className="btn btn-primary btn-sm">
              Go to homepage
            </Link>
            <Link href="/leaderboards" className="btn btn-ghost btn-sm">
              View leaderboards
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
