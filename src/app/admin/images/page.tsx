import Link from "next/link";
import ImageField from "@/components/admin/ImageField";
import RuledHeading from "@/components/RuledHeading";
import { SITE_IMAGE_GROUPS, getSiteImageOverrides } from "@/lib/siteImages";
import { saveSiteImageAction, saveVenueImageAction } from "./actions";
import { getVenues } from "@/lib/venues";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

const day = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default async function AdminImagesPage() {
  const { rows, missingTable } = await getSiteImageOverrides();
  const byKey = new Map(rows.map((r) => [r.key, r]));
  // Venue photos: one per venue, keyed by the venue name the results use.
  const db = await createSupabaseServerClient();
  const [venues, venueRes] = await Promise.all([getVenues(), db.from("venue_images" as any).select("casino, url, updated_at")]);
  const venueMissing = !!venueRes.error;
  const venuePhoto = new Map(((venueRes.data || []) as unknown as { casino: string; url: string; updated_at: string }[]).map((r) => [r.casino, r]));

  return (
    <div className="space-y-[clamp(2rem,3.5vw,3rem)] px-4 py-[clamp(1.75rem,3vw,2.75rem)] sm:px-[3.6vw]">
      <div>
        <h1 className="text-[clamp(2rem,3.2vw,3rem)] font-bold leading-[1.04] tracking-[-0.012em]">Site photos</h1>
        <p className="mt-2 max-w-[48em] text-[1.0625rem] text-season-muted">
          Replace any photo on the site. Until you upload one, each spot shows a generated stand-in. Use photos without recognisable faces unless you have the people&apos;s
          permission.
        </p>
        <div className="mt-4 max-w-[60em] border border-white/[0.08] bg-[linear-gradient(180deg,#0f3337_0%,#0a2427_100%)] p-4 sm:p-5">
          <h2 className="text-[1.0625rem] font-semibold">Best sizes</h2>
          <p className="mt-1 text-[0.9375rem] text-season-ink/80">
            Photos are always cropped to fill their space, never squashed, so the shape matters more than the exact size. Use JPG or WebP, ideally under 1 MB (10 MB at most); the site resizes them for each screen.
          </p>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-[0.9375rem] sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]">
            <dt className="font-medium">Section photos and venues</dt>
            <dd className="text-season-ink/80">2400 × 800 px (3:1). Subject centre-right; the left side darkens behind the title.</dd>
            <dt className="font-medium">Home hero</dt>
            <dd className="text-season-ink/80">2400 × 1000 px (12:5). Subject centred and in the upper half; phones show only the middle.</dd>
            <dt className="font-medium">This week band</dt>
            <dd className="text-season-ink/80">2400 × 800 px (3:1). Keep the right half calm for the figures.</dd>
            <dt className="font-medium">Room, series and festival photos</dt>
            <dd className="text-season-ink/80">2400 × 1350 px (16:9), subject in the centre. They appear as tiles, small thumbnails and wide page tops, so the middle is what always shows.</dd>
            <dt className="font-medium">Plaque marble</dt>
            <dd className="text-season-ink/80">1200 × 800 px or larger, a dark and even texture.</dd>
          </dl>
        </div>
        <p className="mt-2 text-[0.9375rem] text-season-muted">
          Series and festivals can also have their own photo, set on their pages under{" "}
          <Link href="/admin/series" className="text-season-ink underline decoration-season-ink/30 underline-offset-4">Series</Link> and{" "}
          <Link href="/admin/festivals" className="text-season-ink underline decoration-season-ink/30 underline-offset-4">Festivals</Link>. Venue photos are at the bottom of this page.
        </p>
      </div>

      {missingTable && (
        <p role="alert" className="rounded-[3px] border border-season-down/50 bg-season-down/[0.08] px-4 py-3 text-[0.9375rem] text-[#ffb3b1]">
          Photo replacements aren&apos;t set up in the database yet. Run the migration <code>20261003220000_site_images.sql</code> in Supabase, then reload this page.
        </p>
      )}

      {SITE_IMAGE_GROUPS.map((g) => (
        <section key={g.title} aria-labelledby={`g-${g.title}`}>
          <RuledHeading id={`g-${g.title}`}>{g.title}</RuledHeading>
          <p className="mt-2 max-w-[56em] text-[0.9375rem] text-season-muted">{g.note}</p>
          <ul className="mt-4 grid gap-3 lg:grid-cols-2">
            {g.slots.map((s) => {
              const own = byKey.get(s.key);
              return (
                <li key={s.key}>
                  <form action={saveSiteImageAction} className="flex h-full flex-col gap-4 border border-white/[0.08] bg-[linear-gradient(180deg,#0f3337_0%,#0a2427_100%)] p-4 sm:p-5">
                    <input type="hidden" name="key" value={s.key} />
                    <div>
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                        <h3 className="text-[1.125rem] font-semibold">{s.label}</h3>
                        <span className={`text-[0.875rem] ${own ? "text-season-up" : "text-season-muted"}`}>
                          {own ? `Your photo · ${day(own.updated_at)}` : "Default stand-in"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[0.9375rem] text-season-ink/75">{s.where}</p>
                      <p className="text-[0.875rem] text-season-muted">{s.shape}</p>
                    </div>
                    <ImageField name="url" folder="photos" label="Photo" defaultValue={own?.url ?? ""} placeholder={s.fallback} wide />
                    <div className="mt-auto flex flex-wrap gap-3">
                      <button className="btn btn-primary btn-sm" disabled={missingTable}>Save</button>
                    </div>
                  </form>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <section aria-labelledby="g-venues">
        <RuledHeading id="g-venues">Venues</RuledHeading>
        <p className="mt-2 max-w-[56em] text-[0.9375rem] text-season-muted">
          A photo for the top of each venue&apos;s page: 2400 × 800 px (3:1), subject centre-right. Without one, the venue uses the Venues section photo above.
        </p>
        {venueMissing ? (
          <p role="alert" className="mt-4 rounded-[3px] border border-season-down/50 bg-season-down/[0.08] px-4 py-3 text-[0.9375rem] text-[#ffb3b1]">
            Venue photos aren&apos;t set up in the database yet. Run the migration <code>20261004090000_festival_venue_photos.sql</code> in Supabase, then reload this page.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 lg:grid-cols-2">
            {venues.map((v) => {
              const own = venuePhoto.get(v.casino);
              return (
                <li key={v.casino}>
                  <form action={saveVenueImageAction} className="flex h-full flex-col gap-4 border border-white/[0.08] bg-[linear-gradient(180deg,#0f3337_0%,#0a2427_100%)] p-4 sm:p-5">
                    <input type="hidden" name="casino" value={v.casino} />
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                      <h3 className="text-[1.125rem] font-semibold">{v.casino}</h3>
                      <span className={`text-[0.875rem] ${own ? "text-season-up" : "text-season-muted"}`}>
                        {own ? `Its own photo · ${day(own.updated_at)}` : `${v.events.toLocaleString("en-GB")} events · uses the Venues photo`}
                      </span>
                    </div>
                    <ImageField name="url" folder="photos" label="Photo" defaultValue={own?.url ?? ""} wide />
                    <div className="mt-auto">
                      <button className="btn btn-primary btn-sm">Save</button>
                    </div>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
