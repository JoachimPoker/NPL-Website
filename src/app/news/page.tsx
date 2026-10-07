import Image from "next/image";
import Link from "next/link";
import { pageMeta } from "@/lib/site";
import { getSiteImages } from "@/lib/siteImages";
import { createSupabasePublicClient } from "@/lib/supabasePublic";

export const metadata = pageMeta({ title: "News", description: "League news, results round-ups and announcements.", path: "/news" });
export const revalidate = 60;

type Article = {
  id: number;
  title: string;
  category: string | null;
  excerpt: string | null;
  image_url: string | null;
  published_at: string | null;
  is_featured: boolean;
};

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";


export default async function NewsPage() {
  const img = await getSiteImages();
  const supabase = createSupabasePublicClient();
  const { data } = await supabase
    .from("news")
    .select("id, title, category, excerpt, image_url, published_at, is_featured")
    .eq("is_published", true)
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .limit(30);

  const articles = (data || []) as Article[];
  const featured = articles.find((a) => a.is_featured) ?? articles[0];
  const rest = articles.filter((a) => a !== featured);

  return (
    <div className="bg-season-night font-season text-season-ink">
      {/* The lead story opens the page as a full-width still, like the home page. */}
      <section aria-labelledby="lead" className="relative isolate flex min-h-[clamp(30rem,40vw,42rem)] items-end overflow-hidden">
        {featured?.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={featured.image_url} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
        ) : (
          <Image src={img.home_hero} alt="" fill priority sizes="100vw" className="-z-10 object-cover object-[50%_35%]" />
        )}
        <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-10 h-28 bg-gradient-to-b from-season-night/60 to-transparent" />
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-[70%] bg-gradient-to-t from-season-night from-10% via-season-night/75 via-50% to-transparent" />
        <div aria-hidden="true" className="absolute inset-y-0 left-0 -z-10 w-full bg-gradient-to-r from-season-night/80 via-season-night/30 to-transparent sm:w-[65%]" />
        <div className="rise w-full px-4 pb-[clamp(2.5rem,4vw,4rem)] pt-[7.25rem] sm:px-[3.6vw]">
          <h1 className="sr-only">News</h1>
          {featured ? (
            <Link href={`/news/${featured.id}`} className="group block max-w-[46rem]">
              <p className="text-[1rem] font-medium text-season-ink/80">
                {featured.category ?? "News"} <span aria-hidden="true">·</span> <time dateTime={featured.published_at ?? undefined}>{fmt(featured.published_at)}</time>
              </p>
              <h2 id="lead" className="mt-2 text-[clamp(2.25rem,4vw,4.5rem)] font-bold leading-[1.04] tracking-[-0.012em] text-balance decoration-season-ink/40 underline-offset-[0.12em] group-hover:underline">
                {featured.title}
              </h2>
              {featured.excerpt && <p className="mt-3 max-w-[36em] text-[clamp(1.0625rem,1.24vw,1.3125rem)] leading-relaxed text-season-ink/85">{featured.excerpt}</p>}
            </Link>
          ) : (
            <>
              <h2 id="lead" className="text-[clamp(2.5rem,4.4vw,4.375rem)] font-bold leading-[1.02] tracking-[-0.012em]">News</h2>
              <p className="mt-2 text-[clamp(1.0625rem,1.45vw,1.375rem)] text-season-muted">No news yet. Announcements and tournament reports will appear here.</p>
            </>
          )}
        </div>
      </section>

      {rest.length > 0 && (
        <section aria-labelledby="more-news" className="px-4 pb-[clamp(2.5rem,4vw,4rem)] sm:px-[3.6vw]">
          <h2 id="more-news" className="text-[clamp(1.3125rem,1.6vw,1.6875rem)] font-semibold leading-tight">More from the league</h2>
          <ul className="mt-5 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((s, i) => (
              <li key={s.id}>
                <Link href={`/news/${s.id}`} className="group block">
                  <div className="relative aspect-[16/9] overflow-hidden border border-white/[0.08]">
                    {s.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.image_url} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                    ) : (
                      <Image src={img.rooms[i % img.rooms.length]} alt="" fill sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                    )}
                  </div>
                  <p className="mt-4 text-[0.9375rem] text-season-muted">
                    {s.category ?? "News"} <span aria-hidden="true">·</span> <time dateTime={s.published_at ?? undefined}>{fmt(s.published_at)}</time>
                  </p>
                  <h3 className="mt-1 text-[1.375rem] font-semibold leading-snug decoration-season-ink/40 underline-offset-4 group-hover:underline">{s.title}</h3>
                  {s.excerpt && <p className="mt-2 line-clamp-2 text-[1rem] leading-relaxed text-season-ink/75">{s.excerpt}</p>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
