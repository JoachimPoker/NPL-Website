import Link from "next/link";
import { pageMeta } from "@/lib/site";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const revalidate = 60;

async function getArticle(id: string) {
  const articleId = Number(id);
  if (!Number.isFinite(articleId)) return null;
  const supabase = await createSupabaseServerClient();
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
    <article className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/news" className="inline-flex items-center gap-1.5 text-sm text-base-content/55 hover:text-base-content">
        <ArrowLeft size={14} aria-hidden="true" /> All news
      </Link>

      <header className="mt-6 space-y-3">
        <div className="eyebrow text-primary/90">{a.category ?? "News"}</div>
        <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight md:text-5xl">{a.title}</h1>
        {a.published_at && (
          <time className="block font-mono text-xs text-base-content/45">
            {new Date(a.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </time>
        )}
      </header>

      {a.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.image_url} alt="" className="mt-8 w-full rounded-2xl object-cover ring-1 ring-base-content/[0.07]" />
      )}

      <div className="mt-8 space-y-5 text-lg leading-relaxed text-base-content/80">
        {a.excerpt && <p className="text-xl text-base-content">{a.excerpt}</p>}
        {paragraphs.map((p, i) => (
          <p key={i} className="whitespace-pre-line">{p}</p>
        ))}
      </div>

      {a.social_link && (
        <a href={a.social_link} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm mt-10 gap-2">
          View original post <ExternalLink size={14} aria-hidden="true" />
        </a>
      )}
    </article>
  );
}
