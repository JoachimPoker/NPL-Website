import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const revalidate = 0;

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) redirect(`/login?next=/admin/series/new`);
  
  // Basic Admin Check
  const roles: string[] = ((user.app_metadata as any)?.roles ?? []) as string[];
  const isAdmin = roles.includes("admin") || (user.user_metadata as any)?.is_admin === true;
  
  if (!isAdmin) redirect("/");
  return { supabase, user };
}

// ✅ Added props to capture 'searchParams' for error display
export default async function NewSeriesPage(props: { searchParams: Promise<{ error?: string }> }) {
  await requireAdmin();
  const searchParams = await props.searchParams;

  async function createSeries(formData: FormData) {
    "use server";
    const { supabase } = await requireAdmin();

    const name = String(formData.get("name") || "").trim();
    const slug = String(formData.get("slug") || "").trim().toLowerCase();
    const descriptionRaw = String(formData.get("description") || "").trim();

    if (!name || !slug) {
      redirect("/admin/series/new?error=Missing+name+or+slug");
    }

    const description = descriptionRaw || null;

    const { data, error } = await supabase
      .from("series")
      .insert([{ name, slug, description, is_active: true }])
      .select("id")
      .single();

    if (error || !data?.id) {
      redirect(
        "/admin/series/new?error=" +
          encodeURIComponent(error?.message || "Failed to create series")
      );
    }

    redirect(`/admin/series/${data.id}`);
  }

  return (
    <div className="space-y-6 container mx-auto max-w-2xl py-8">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-2xl font-black uppercase italic text-white">New Series</h1>
            <p className="text-xs text-base-content/60">Create a brand (e.g. GUKPT, APAT)</p>
        </div>
        <Link href="/admin/series" className="btn btn-ghost btn-sm">Cancel</Link>
      </div>

      {/* ✅ Error Alert */}
      {searchParams.error && (
        <div className="alert alert-error text-xs shadow-lg">
          <span>⚠️ {searchParams.error}</span>
        </div>
      )}

      <form action={createSeries} className="card bg-base-100 shadow-xl border border-white/5">
        <div className="card-body space-y-4">
          
          <div className="form-control">
            <label className="label"><span className="label-text text-xs font-bold uppercase">Name</span></label>
            <input name="name" className="input input-bordered" placeholder="e.g. UK Poker League" required />
          </div>

          <div className="form-control">
            <label className="label"><span className="label-text text-xs font-bold uppercase">Slug</span></label>
            <input 
                name="slug" 
                className="input input-bordered font-mono text-sm" 
                placeholder="ukpl" 
                pattern="^[a-z0-9-]+$"
                title="Lowercase letters, numbers, and dashes only"
                required 
            />
          </div>

          <div className="form-control">
            <label className="label"><span className="label-text text-xs font-bold uppercase">Description</span></label>
            <textarea name="description" className="textarea textarea-bordered h-24" placeholder="Brief details about this tour..."></textarea>
          </div>

          <div className="card-actions justify-end mt-4">
            <button className="btn btn-primary uppercase font-bold tracking-widest" type="submit">
              Create Series
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}