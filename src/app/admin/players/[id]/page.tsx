import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { updatePlayerAction, deletePlayerAction } from "../actions";

// Ensure this page is not statically cached since it depends on Auth
export const dynamic = "force-dynamic";

export default async function EditPlayerPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createSupabaseServerClient();

  // 1. Check Admin Auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/admin/players/${params.id}`);

  // 2. Fetch Player Data
  const { data: player, error } = await supabase
    .from("players")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !player) {
    notFound();
  }

  return (
    <div className="container mx-auto max-w-2xl py-8 space-y-8">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black uppercase italic text-white">
            Edit Player
          </h1>
          <p className="text-sm text-base-content/60">
            ID: <span className="font-mono">{player.id}</span>
          </p>
        </div>
        <Link href="/admin/players" className="btn btn-ghost btn-sm">
          Back to List
        </Link>
      </div>

      {/* UPDATE FORM */}
      <div className="card bg-base-100 shadow-xl border border-white/5">
        <div className="card-body">
          <form action={updatePlayerAction} className="space-y-4">
            <input type="hidden" name="id" value={player.id} />

            <div className="grid grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-bold">Forename</span>
                </label>
                <input
                  name="forename"
                  defaultValue={player.forename || ""}
                  className="input input-bordered w-full"
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-bold">Surname</span>
                </label>
                <input
                  name="surname"
                  defaultValue={player.surname || ""}
                  className="input input-bordered w-full"
                />
              </div>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-bold">Bio</span>
              </label>
              <textarea
                name="bio"
                defaultValue={player.bio || ""}
                className="textarea textarea-bordered h-32"
                placeholder="Player biography..."
              />
            </div>

            <div className="card-actions justify-end mt-4">
              <button type="submit" className="btn btn-primary font-bold">
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* DANGER ZONE */}
      <div className="card bg-red-950/20 border border-red-900/50 shadow-xl">
        <div className="card-body">
          <h3 className="card-title text-red-500 text-sm uppercase font-black">
            Danger Zone
          </h3>
          <p className="text-xs text-red-400/80 mb-4">
            Deleting a player will remove them from all leaderboards. This action cannot be undone.
          </p>
          
          <form action={deletePlayerAction}>
            <input type="hidden" name="id" value={player.id} />
            <button 
              type="submit" 
              className="btn btn-error btn-outline btn-sm w-full sm:w-auto"
            >
              Delete Player Permanently
            </button>
          </form>
        </div>
      </div>

    </div>
  );
}