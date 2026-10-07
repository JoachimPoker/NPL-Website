import Link from "next/link";
import { pageMeta } from "@/lib/site";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { createSupabasePublicClient } from "@/lib/supabasePublic";

export const revalidate = 60;
// None built ahead: each page is rendered on its first visit, then served from cache.
export function generateStaticParams() {
  return [];
}

async function getArticle(id: string) {
  const articleId = Number(id);
  if (!Number.isFinite(articleId)) return null;
  const supabase = createSupabasePublicClient();
  const { data } = await supabase
    .from("news")
    .select("id, title, category, excerpt, content, image_url, social_link, published_at")
    .eq("id", articleId)
    .eq("is_published", true)
    .maybeSingle();
  return data;
}

export async function generateMetadata(props: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const a = await getArticle((await props.params).id);
  return a ? pageMeta({ title: a.title, description: a.excerpt ?? undefined, path: `/news/${a.id}` }) : { title: "News" };
}

export default async function NewsArticlePage(props: { params: Promise<{ id: string }> }) {
  const a = await getArticle((await props.params).id);
  if (!a) notFound();

  // Plain text: blank lines separate paragraphs.
  const paragraphs = (a.content ?? "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  return (
    <div className="bg-season-night font-season text-season-ink">
      <article className="mx-auto w-full max-w-[44rem] px-4 pb-[clamp(2.5rem,4vw,4rem)] pt-[clamp(2rem,4vw,3.5rem)] sm:px-6">
        <Link href="/news" className="inline-flex min-h-11 items-center gap-1.5 text-[0.9375rem] font-medium text-season-ink/75 hover:text-season-ink">
          <ArrowLeft size={16} strokeWidth={2.25} aria-hidden="true" /> All news
        </Link>

        <header className="mt-6">
          <p className="text-[1rem] font-medium text-season-muted">
            {a.category ?? "News"}
            {a.published_at && (
              <>
                {" "}<span aria-hidden="true">·</span>{" "}
                <time dateTime={a.published_at}>{new Date(a.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</time>
              </>
            )}
          </p>
          <h1 className="mt-2 text-[clamp(2.25rem,4vw,3.75rem)] font-bold leading-[1.06] tracking-[-0.012em] text-balance">{a.title}</h1>
          {a.excerpt && <p className="mt-5 text-[clamp(1.1875rem,1.5vw,1.375rem)] leading-relaxed text-season-ink/90">{a.excerpt}</p>}
        </header>

        {a.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.image_url} alt="" className="mt-8 w-full border border-white/[0.08] object-cover" />
        )}

        <div className="mt-8 space-y-5 text-[1.125rem] leading-[1.7] text-season-ink/85">
          {paragraphs.map((p, i) => (
            <p key={i} className="whitespace-pre-line">{p}</p>
          ))}
        </div>

        {a.social_link && (
          <a
            href={a.social_link}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-10 inline-flex h-11 items-center gap-2 rounded-[3px] border border-white/[0.14] px-4 text-[0.9375rem] font-medium transition-colors hover:border-white/30"
          >
            View the original post <ExternalLink size={15} aria-hidden="true" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        )}
      </article>
    </div>
  );
}
