// Profile-shaped skeleton (the players list has its own in ../loading.tsx).
export default function LoadingPlayerProfile() {
  return (
    <div aria-busy="true" aria-label="Loading player">
      <div className="border-b border-base-content/[0.07]">
        <div className="mx-auto max-w-7xl px-4 pb-10 pt-10 sm:px-6 md:pt-14 lg:px-8">
          <div className="skeleton h-3 w-16" />
          <div className="mt-6 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <div className="flex items-end gap-5">
              <div className="skeleton h-24 w-24 rounded-2xl md:h-32 md:w-32" />
              <div className="space-y-3">
                <div className="skeleton h-10 w-64 md:h-14 md:w-80" />
                <div className="skeleton h-4 w-24" />
              </div>
            </div>
            <div className="flex gap-10">
              <div className="skeleton h-14 w-28" />
              <div className="skeleton h-14 w-32" />
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-3 lg:px-8">
        <div className="space-y-8 lg:col-span-2">
          <div className="skeleton h-44 rounded-box" />
          <div className="skeleton h-40 rounded-box" />
          <div className="skeleton h-80 rounded-box" />
        </div>
        <div className="space-y-6">
          <div className="skeleton h-56 rounded-box" />
          <div className="skeleton h-64 rounded-box" />
        </div>
      </div>
    </div>
  );
}
