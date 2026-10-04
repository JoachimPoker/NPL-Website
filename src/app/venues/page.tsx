import Link from "next/link";
import { pageMeta } from "@/lib/site";
import { getVenues, getUpcoming, venueHref } from "@/lib/venues";
import { day } from "@/lib/tournaments";
import { getSiteImages } from "@/lib/siteImages";
import { TitleBand } from "@/components/tournaments/ComingUp";

export const metadata = pageMeta({ title: "Venues", description: "Every casino and card room that has hosted league events.", path: "/venues" });
export const revalidate = 600;

export default async function VenuesPage() {
  const img = await getSiteImages();
  const [venues, upcoming] = await Promise.all([getVenues(), getUpcoming({ limit: 50 })]);
  const upcomingAt = new Map<string, number>();
  for (const u of upcoming) if (u.casino) upcomingAt.set(u.casino, (upcomingAt.get(u.casino) ?? 0) + 1);

  return (
    <div className="bg-season-night font-season text-season-ink">
      <TitleBand image={img.venues_hero} position="object-[65%_50%]">
        <h1 className="text-[clamp(2.5rem,4.4vw,4.375rem)] font-bold leading-[1.02] tracking-[-0.012em]">Venues</h1>
        <p className="mt-2 max-w-[32em] text-[clamp(1.0625rem,1.45vw,1.375rem)] font-medium text-season-muted">
          <span className="tabular-nums">{venues.length}</span> casinos and card rooms that have hosted league events, busiest first.
        </p>
      </TitleBand>

      <div className="px-4 pb-[clamp(2.5rem,4vw,4rem)] sm:px-[3.6vw]">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left tabular-nums">
            <caption className="sr-only">Venues, by number of league events</caption>
            <thead>
              <tr className="border-b border-white/[0.12] text-[0.875rem] text-season-muted">
                <th scope="col" className="w-full pb-3 font-medium">Venue</th>
                <th scope="col" className="pb-3 pl-5 text-right font-medium">Events</th>
                <th scope="col" className="hidden pb-3 pl-5 text-right font-medium sm:table-cell">Festivals</th>
                <th scope="col" className="hidden pb-3 pl-5 text-right font-medium md:table-cell">Cashes</th>
                <th scope="col" className="hidden whitespace-nowrap pb-3 pl-5 text-right font-medium lg:table-cell">Last event</th>
              </tr>
            </thead>
            <tbody>
              {venues.map((v) => (
                <tr key={v.casino} className="border-b border-white/[0.07] transition-colors hover:bg-white/[0.025]">
                  <td className="max-w-0">
                    <Link href={venueHref(v.casino)} className="flex min-h-14 items-center gap-3 py-3">
                      <span className="truncate text-[1.125rem] font-semibold decoration-season-ink/40 underline-offset-4 hover:underline">{v.casino}</span>
                      {upcomingAt.get(v.casino) ? (
                        <span className="shrink-0 rounded-[3px] px-1.5 text-[0.8125rem] font-semibold text-season-amber shadow-[inset_0_0_0_1px_rgb(242_163_58/0.6)]">Coming up</span>
                      ) : null}
                    </Link>
                  </td>
                  <td className="pl-5 text-right text-[1.0625rem] font-semibold">{v.events.toLocaleString("en-GB")}</td>
                  <td className="hidden pl-5 text-right text-season-ink/80 sm:table-cell">{v.festivals || <span className="text-season-muted">–</span>}</td>
                  <td className="hidden pl-5 text-right text-season-ink/80 md:table-cell">{v.cashes.toLocaleString("en-GB")}</td>
                  <td className="hidden whitespace-nowrap pl-5 text-right text-season-muted lg:table-cell">{day(v.last_event, { day: "numeric", month: "short", year: "numeric" })}</td>
                </tr>
              ))}
              {!venues.length && (
                <tr><td colSpan={5} className="py-16 text-center text-season-ink/80">No venues yet. They appear after the first results update.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
