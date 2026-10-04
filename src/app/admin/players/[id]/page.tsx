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
    .select("id, forename, surname, bio")
    .eq("id", Number(params.id))
    .single();

  if (error || !player) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      
      <div className="flex flex-col gap-4 border-b border-base-content/[0.07] pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <Link href="/admin/players" className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-[0.9375rem] font-medium text-season-ink/75 hover:text-season-ink"><span aria-hidden="true">←</span> Players</Link>
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
            {[player.forename, player.surname].filter(Boolean).join(" ") || "Unknown player"}
          </h1>
        </div>
        <div className="flex gap-2">
          <Link href={`/players/${player.id}`} className="btn btn-ghost btn-sm">Public profile</Link>
          <Link href="/admin/players" className="btn btn-ghost btn-sm">← Players</Link>
        </div>
      </div>

      {/* UPDATE FORM */}
      <div className="panel">
        <div className="card-body">
          <form action={updatePlayerAction} className="space-y-4">
            <input type="hidden" name="id" value={player.id} />

            <div className="grid grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text text-xs font-bold">Forename</span>
                </label>
                <input
                  name="forename"
                  defaultValue={player.forename || ""}
                  className="input input-bordered w-full"
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text text-xs font-bold">Surname</span>
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
                <span className="label-text text-xs font-bold">Bio</span>
              </label>
              <textarea
                name="bio"
                defaultValue={player.bio || ""}
                className="textarea textarea-bordered h-32 w-full"
                placeholder="Player biography..."
              />
            </div>

            <div className="card-actions justify-end mt-4">
              <button type="submit" className="btn btn-primary btn-sm">
                Save changes
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* DANGER ZONE */}
      <div className="panel border-error/30 bg-error/[0.04]">
        <div className="card-body">
          <h3 className="font-display font-semibold text-error text-base">
            Danger zone
          </h3>
          <p className="mb-4 text-xs text-error/80">
            Deleting a player will remove them from all leaderboards. This action cannot be undone.
          </p>
          
          <form action={deletePlayerAction}>
            <input type="hidden" name="id" value={player.id} />
            <button 
              type="submit" 
              className="btn btn-error btn-outline btn-sm w-full sm:w-auto"
            >
              Delete player permanently
            </button>
          </form>
        </div>
      </div>

    </div>
  );
}