import Link from "next/link";
import { pageMeta } from "@/lib/site";
import { MapPin } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { getVenues, getUpcoming, venueHref } from "@/lib/venues";
import { gbpShort, day } from "@/lib/tournaments";

export const metadata = pageMeta({ title: "Venues", description: "Every casino and card room that has hosted league events.", path: "/venues" });
export const revalidate = 600;

export default async function VenuesPage() {
  const [venues, upcoming] = await Promise.all([getVenues(), getUpcoming({ limit: 50 })]);
  const upcomingAt = new Map<string, number>();
  for (const u of upcoming) if (u.casino) upcomingAt.set(u.casino, (upcomingAt.get(u.casino) ?? 0) + 1);

  return (
    <>
      <PageHeader
        eyebrow="Venues"
        title="Where the league plays"
        description={`${venues.length} casinos and card rooms that have hosted league events, busiest first.`}
      />
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {venues.map((v) => (
            <li key={v.casino}>
              <Link href={venueHref(v.casino)} className="panel group flex h-full flex-col gap-4 p-5 transition-colors hover:border-primary/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-primary/12 text-primary ring-1 ring-inset ring-primary/20">
                      <MapPin size={18} aria-hidden="true" />
                    </span>
                    <h2 className="font-display text-lg font-semibold transition-colors group-hover:text-primary">{v.casino}</h2>
                  </div>
                  {upcomingAt.get(v.casino) ? (
                    <span className="shrink-0 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">Coming up</span>
                  ) : null}
                </div>
                <dl className="grid grid-cols-3 gap-2 text-center">
                  {[
                    ["Events", v.events.toLocaleString("en-GB")],
                    ["Cashes", v.cashes.toLocaleString("en-GB")],
                    ["Paid out", gbpShort(Number(v.paid_out))],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg bg-base-200/60 px-2 py-2">
                      <dt className="text-[10px] uppercase tracking-wider text-base-content/45">{label}</dt>
                      <dd className="font-mono text-sm font-semibold">{value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-auto text-xs text-base-content/45">Last event {day(v.last_event, { day: "numeric", month: "short", year: "numeric" })}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
