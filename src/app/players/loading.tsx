// src/app/players/loading.tsx
export default function LoadingPlayers() {
  return (
    <div className="space-y-6">
      <section className="card bg-base-100 shadow-sm">
        <div className="card-body space-y-3">
          <div className="flex justify-between items-center">
            <div className="skeleton h-6 w-32" />
            <div className="skeleton h-4 w-40" />
          </div>
          <div className="skeleton h-10 w-full" />
        </div>
      </section>

      <section className="card bg-base-100 shadow-sm">
        <div className="card-body space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 py-3 border-b border-base-200 last:border-0"
            >
              <div className="skeleton w-10 h-10 rounded-full" />
              <div className="flex-1 space-y-1">
                <div className="skeleton h-4 w-1/3" />
                <div className="skeleton h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
