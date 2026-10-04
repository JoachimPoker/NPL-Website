// Profile-shaped skeleton (the players list has its own in ../loading.tsx): the dark hero with the
// name, the row of title plaques, the tabs, then the two overview columns.
const bone = "animate-pulse rounded-[3px] bg-white/[0.07]";

export default function LoadingPlayerProfile() {
  return (
    <div aria-busy="true" aria-label="Loading player" className="bg-season-night font-season">
      <div className="flex min-h-[clamp(25rem,30vw,33rem)] items-end bg-[linear-gradient(180deg,#0b2629_0%,#06191c_100%)] px-4 pb-[clamp(2rem,3vw,3rem)] pt-[7.5rem] sm:px-[3.6vw]">
        <div className="flex w-full items-center gap-6">
          <div className="w-full space-y-3">
            <div className={`${bone} h-14 w-full max-w-lg`} />
            <div className={`${bone} h-5 w-56`} />
          </div>
        </div>
      </div>
      <div className="px-4 pb-24 sm:px-[3.6vw]">
        <div className="grid gap-4 md:grid-cols-3">
          <div className={`${bone} h-24`} />
          <div className={`${bone} hidden h-24 md:block`} />
          <div className={`${bone} hidden h-24 md:block`} />
        </div>
        <div className="mt-12 flex gap-8 border-b border-white/[0.1] pb-4">
          <div className={`${bone} h-5 w-20`} />
          <div className={`${bone} h-5 w-20`} />
          <div className={`${bone} h-5 w-28`} />
        </div>
        <div className="mt-10 grid gap-12 lg:grid-cols-[5fr_6fr]">
          <div className={`${bone} h-64`} />
          <div className={`${bone} h-80`} />
        </div>
      </div>
    </div>
  );
}
