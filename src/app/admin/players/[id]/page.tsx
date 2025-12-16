import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";
import Link from "next/link";

export const runtime = "nodejs";

export default async function AdminPlayerEdit(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params;
  const supabase = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: p } = await supabase.from("players").select("*").eq("id", id).single();

  if (!p) return <div className="p-12 text-center">Player not found</div>;

  async function updatePlayer(formData: FormData) {
    "use server";
    const sb = await createSupabaseServerClient();
    const payload = {
      forename: formData.get("forename") as string,
      surname: formData.get("surname") as string,
      display_name: formData.get("display_name") as string || null,
      email: formData.get("email") as string || null,
    };
    await sb.from("players").update(payload).eq("id", id);
    redirect("/admin/players");
  }

  return (
    <div className="container mx-auto max-w-3xl space-y-8 py-8 px-4">
      <div className="flex items-center justify-between border-b border-white/5 pb-6">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-primary mb-1">Edit Player</div>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter text-white">
            {p.forename} {p.surname}
          </h1>
        </div>
      </div>

      <div className="card bg-base-100 shadow-xl border border-white/5">
        <div className="card-body p-8">
          <form action={updatePlayer} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="form-control">
                <label className="label text-xs uppercase font-bold text-base-content/50">Forename</label>
                <input name="forename" defaultValue={p.forename} className="input input-bordered bg-base-200/50 focus:bg-base-200" required />
              </div>
              <div className="form-control">
                <label className="label text-xs uppercase font-bold text-base-content/50">Surname</label>
                <input name="surname" defaultValue={p.surname} className="input input-bordered bg-base-200/50 focus:bg-base-200" required />
              </div>
            </div>

            <div className="form-control">
              <label className="label text-xs uppercase font-bold text-base-content/50">Display Name / Alias</label>
              <input name="display_name" defaultValue={p.display_name ?? ""} placeholder="e.g. 'PokerKing'" className="input input-bordered bg-base-200/50 focus:bg-base-200" />
              <label className="label text-xs text-base-content/40">If set, this will be shown on leaderboards instead of the real name.</label>
            </div>

            <div className="form-control">
              <label className="label text-xs uppercase font-bold text-base-content/50">Email (Private)</label>
              <input name="email" type="email" defaultValue={p.email ?? ""} className="input input-bordered bg-base-200/50 focus:bg-base-200" />
            </div>

            <div className="flex gap-4 pt-4">
              <button type="submit" className="btn btn-primary uppercase font-bold tracking-widest px-8">Save Changes</button>
              <Link href="/admin/players" className="btn btn-ghost uppercase font-bold">Cancel</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}