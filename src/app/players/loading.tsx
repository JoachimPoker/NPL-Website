// src/app/players/loading.tsx
export default function LoadingPlayers() {
  return (
    <div aria-busy="true" aria-label="Loading players">
      <div className="border-b border-base-content/[0.07]">
        <div className="mx-auto max-w-7xl space-y-3 px-4 pb-7 pt-7 sm:px-6 md:pt-10 lg:px-8">
          <div className="skeleton h-3 w-20" />
          <div className="skeleton h-10 w-72" />
          <div className="skeleton h-4 w-80" />
        </div>
      </div>
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex gap-2">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-8 w-24 rounded-full" />)}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-20 rounded-box" />)}
        </div>
        <ul className="panel">
          {Array.from({ length: 10 }).map((_, i) => (
            <li key={i} className="flex items-center gap-4 border-b border-base-content/[0.06] px-6 py-4 last:border-0">
              <div className="skeleton h-4 w-6" />
              <div className="skeleton h-9 w-9 rounded-[10px]" />
              <div className="skeleton h-4 max-w-48 flex-1" />
              <div className="skeleton ml-auto h-4 w-16" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
