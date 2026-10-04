import Image from "next/image";
import Link from "next/link";
import { getSiteImages } from "@/lib/siteImages";
import { ArrowRight } from "lucide-react";

/**
 * The featured story: one cinematic still opens the page and dissolves into it (no hard edge), with a
 * title card over it. The photo is a generated stand-in (no real people); swap in real event photography.
 */
export default async function SeasonHero({ headline, line }: { headline: string; line: string }) {
  const img = await getSiteImages();
  return (
    <section
      aria-labelledby="featured-heading"
      className="relative isolate flex h-[38rem] items-end overflow-hidden bg-season-night font-season text-season-ink sm:h-[clamp(30rem,36vw,46rem)]"
    >
      <Image
        src={img.home_hero}
        alt=""
        fill
        priority
        sizes="100vw"
        className="-z-10 object-cover object-[50%_0%] sm:object-[50%_35%]"
      />
      {/* The photo falls away into the page ground: a long fade at the bottom, so the next section begins
          inside the room's light rather than under a seam. On larger screens the left side also darkens
          behind the title card. */}
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-[70%] bg-gradient-to-t from-season-night from-15% via-season-night/75 via-50% to-transparent sm:h-[55%] sm:from-0%" />
      <div aria-hidden="true" className="absolute inset-y-0 left-0 -z-10 hidden w-[60%] bg-gradient-to-r from-season-night/80 via-season-night/35 to-transparent sm:block" />

      <div className="rise w-full px-4 pb-[clamp(3.5rem,6vw,7rem)] sm:px-[3.6vw]">
        <h1 id="featured-heading" className="text-[clamp(2.5rem,4.3vw,5.5rem)] font-bold leading-[1.02] tracking-[-0.012em] text-balance">
          {headline}
        </h1>
        <p className="mt-[0.95rem] max-w-[29em] text-[clamp(1.0625rem,1.24vw,1.4375rem)] font-medium leading-[1.5] text-season-ink/90">{line}</p>
        <div className="mt-6 flex flex-wrap items-center gap-x-[1.9rem] gap-y-3">
          <Link
            href="/leaderboards#find"
            className="inline-flex h-[2.95rem] items-center gap-2.5 rounded-[3px] bg-season-amber px-[1.4rem] text-[clamp(1rem,1.1vw,1.125rem)] font-semibold text-season-amber-ink transition-colors hover:bg-[#f6b45a]"
          >
            Find my standing
            <ArrowRight size={18} strokeWidth={2.25} aria-hidden="true" />
          </Link>
          <Link
            href="/leaderboards"
            className="group inline-flex min-h-11 items-center gap-2 border-b border-transparent text-[clamp(1rem,1.05vw,1.0625rem)] font-medium text-season-ink hover:border-season-ink/50"
          >
            All leaderboards
            <ArrowRight size={17} strokeWidth={2} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
