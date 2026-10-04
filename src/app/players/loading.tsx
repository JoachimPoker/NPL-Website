// src/app/players/loading.tsx
// Mirrors the page: the title band with the search, then the ranked rows.
const bone = "animate-pulse rounded-[3px] bg-white/[0.07]";

export default function LoadingPlayers() {
  return (
    <div aria-busy="true" aria-label="Loading players" className="bg-season-night font-season">
      <div className="flex min-h-[clamp(18rem,21vw,22.5rem)] items-end bg-[linear-gradient(180deg,#0b2629_0%,#06191c_100%)] px-4 pb-[clamp(2rem,3vw,3rem)] pt-[7.25rem] sm:px-[3.6vw]">
        <div className="w-full space-y-4">
          <div className={`${bone} h-14 w-64`} />
          <div className={`${bone} h-5 w-80 max-w-full`} />
          <div className={`${bone} h-12 w-full max-w-[34rem]`} />
        </div>
      </div>
      <div className="px-4 pb-24 sm:px-[3.6vw]">
        <div className={`${bone} h-11 w-64`} />
        <ul className="mt-6 border-t border-white/[0.12]">
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
