import Link from "next/link";
import { pageMeta } from "@/lib/site";
import PageHeader from "@/components/PageHeader";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

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
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";

export default async function NewsPage() {
  const supabase = await createSupabaseServerClient();
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
    <>
      <PageHeader eyebrow="News" title="From the league" description="Announcements and tournament reports from the National Poker League." />

      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {!featured ? (
          <div className="panel px-6 py-16 text-center">
            <div className="font-display text-lg">No news yet</div>
            <p className="mt-1 text-sm text-base-content/50">Check back soon for announcements and tournament reports.</p>
          </div>
        ) : (
          <div className="grid gap-10 lg:grid-cols-12">
            <Link href={`/news/${featured.id}`} className="group panel relative overflow-hidden lg:col-span-7">
              {featured.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={featured.image_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40 transition-opacity group-hover:opacity-50" />
              ) : (
                <div className="felt-glow pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
              )}
              <div className="relative flex h-full min-h-72 flex-col justify-end gap-4 bg-gradient-to-t from-base-100 via-base-100/60 to-transparent p-8 md:p-10">
                <div className="eyebrow text-primary/90">{featured.category ?? "Featured"}</div>
                <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight transition-colors group-hover:text-primary md:text-5xl">
                  {featured.title}
                </h2>
                {featured.excerpt && <p className="max-w-lg text-base-content/70">{featured.excerpt}</p>}
                <time className="font-mono text-xs text-base-content/50">{fmt(featured.published_at)}</time>
              </div>
            </Link>

            <div className="divide-y divide-base-content/[0.07] lg:col-span-5">
              {rest.map((s) => (
                <Link key={s.id} href={`/news/${s.id}`} className="group flex gap-4 py-6 first:pt-0">
                  {s.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.image_url} alt="" className="h-20 w-28 shrink-0 rounded-lg object-cover" />
                  )}
                  <article className="min-w-0 space-y-2">
                    <div className="flex items-center justify-between gap-4">
                      <span className="eyebrow">{s.category ?? "News"}</span>
                      <time className="font-mono text-xs text-base-content/40">{fmt(s.published_at)}</time>
                    </div>
                    <h3 className="font-display text-xl font-semibold transition-colors group-hover:text-primary">{s.title}</h3>
                    {s.excerpt && <p className="line-clamp-2 text-sm text-base-content/55">{s.excerpt}</p>}
                  </article>
                </Link>
              ))}
              {!rest.length && <p className="text-sm text-base-content/50">More stories coming soon.</p>}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
