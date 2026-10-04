// src/app/leaderboards/loading.tsx
// Mirrors the page: the title card over the dark hero, the control row, then the table's rows.
const bone = "animate-pulse rounded-[3px] bg-white/[0.07]";

export default function LoadingLeaderboards() {
  return (
    <div aria-busy="true" aria-label="Loading the leaderboards" className="bg-season-night font-season">
      <div className="flex min-h-[clamp(22rem,27vw,29rem)] items-end bg-[linear-gradient(180deg,#0b2629_0%,#06191c_100%)] px-4 pb-[clamp(2.25rem,3.5vw,3.5rem)] pt-[7.5rem] sm:px-[3.6vw]">
        <div className="w-full space-y-4">
          <div className={`${bone} h-6 w-56`} />
          <div className={`${bone} h-5 w-40`} />
          <div className={`${bone} h-14 w-full max-w-md`} />
          <div className={`${bone} h-14 w-48`} />
        </div>
      </div>
      <div className="px-4 pb-24 sm:px-[3.6vw]">
        <div className="flex flex-wrap gap-6">
          <div className={`${bone} h-11 w-80 max-w-full`} />
          <div className={`${bone} h-11 w-72 max-w-full`} />
          <div className={`${bone} h-12 min-w-64 flex-1`} />
        </div>
        <ul className="mt-14 border-t border-white/[0.12]">
          {Array.from({ length: 10 }).map((_, i) => (
            <li key={i} className="flex h-[3.75rem] items-center gap-6 border-b border-white/[0.07]">
              <div className={`${bone} h-4 w-6`} />
              <div className={`${bone} h-4 max-w-56 flex-1`} />
              <div className={`${bone} ml-auto h-4 w-16`} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
