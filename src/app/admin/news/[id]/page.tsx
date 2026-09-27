import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { saveNewsAction, deleteNewsAction } from "../actions";
import ImageField from "@/components/admin/ImageField";

export const dynamic = "force-dynamic";

const CATEGORIES = ["Announcement", "Tournament report", "League update", "Player spotlight", "Results"];

// "YYYY-MM-DDTHH:mm" for <input type="datetime-local">, in UK time.
function localInput(iso: string | null) {
  const d = iso ? new Date(iso) : new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default async function AdminNewsEditPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const isNew = id === "new";

  let article: any = null;
  if (!isNew) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.from("news").select("*").eq("id", Number(id)).maybeSingle();
    if (!data) notFound();
    article = data;
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      <div className="flex items-end justify-between border-b border-base-content/[0.07] pb-6">
        <div>
          <div className="eyebrow mb-2 text-primary">News</div>
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{isNew ? "New article" : "Edit article"}</h1>
        </div>
        <Link href="/admin/news" className="btn btn-ghost btn-sm">← All news</Link>
      </div>

      <form action={saveNewsAction} className="space-y-6">
        {!isNew && <input type="hidden" name="id" value={article.id} />}

        <div className="grid gap-4 md:grid-cols-3">
          <label className="form-control md:col-span-2">
            <span className="label-text mb-1 text-xs font-bold">Title</span>
            <input name="title" required defaultValue={article?.title ?? ""} className="input input-bordered" />
          </label>
          <label className="form-control">
            <span className="label-text mb-1 text-xs font-bold">Category</span>
            <input name="category" list="news-categories" defaultValue={article?.category ?? ""} className="input input-bordered" placeholder="e.g. Tournament report" />
            <datalist id="news-categories">
              {CATEGORIES.map((c) => <option key={c} value={c} />)}
            </datalist>
          </label>
        </div>

        <label className="form-control">
          <span className="label-text mb-1 text-xs font-bold">Summary</span>
          <textarea name="excerpt" rows={2} defaultValue={article?.excerpt ?? ""} className="textarea textarea-bordered" placeholder="One or two sentences shown in the news list." />
        </label>

        <label className="form-control">
          <span className="label-text mb-1 text-xs font-bold">Article</span>
          <textarea name="content" rows={14} defaultValue={article?.content ?? ""} className="textarea textarea-bordered font-mono text-sm leading-relaxed" placeholder="Leave a blank line between paragraphs." />
        </label>

        <ImageField defaultValue={article?.image_url ?? ""} />

        <div className="grid gap-4 md:grid-cols-2">
          <label className="form-control">
            <span className="label-text mb-1 text-xs font-bold">Link (optional)</span>
            <input name="social_link" type="url" defaultValue={article?.social_link ?? ""} className="input input-bordered" placeholder="https://… (e.g. a Facebook or X post)" />
          </label>
          <label className="form-control">
            <span className="label-text mb-1 text-xs font-bold">Publish date</span>
            <input name="published_at" type="datetime-local" defaultValue={localInput(article?.published_at ?? null)} className="input input-bordered" />
          </label>
        </div>

        <div className="flex flex-wrap gap-6">
          <label className="label cursor-pointer gap-3">
            <input type="checkbox" name="is_published" defaultChecked={article?.is_published ?? true} className="toggle toggle-success toggle-sm" />
            <span className="label-text">Published (untick to save as a draft)</span>
          </label>
          <label className="label cursor-pointer gap-3">
            <input type="checkbox" name="is_featured" defaultChecked={article?.is_featured ?? false} className="toggle toggle-primary toggle-sm" />
            <span className="label-text">Featured story (shown large at the top)</span>
          </label>
        </div>

        <div className="flex gap-3">
          <button className="btn btn-primary">Save</button>
          <Link href="/admin/news" className="btn btn-ghost">Cancel</Link>
        </div>
      </form>

      {!isNew && (
        <form action={deleteNewsAction} className="border-t border-base-content/[0.07] pt-6">
          <input type="hidden" name="id" value={article.id} />
          <button className="btn btn-error btn-outline btn-sm">Delete article</button>
        </form>
      )}
    </div>
  );
}
