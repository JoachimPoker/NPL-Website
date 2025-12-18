import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { updateFestivalAction, deleteFestivalAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditFestivalPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createSupabaseServerClient();

  // 1. Auth Check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 2. Fetch Data
  const { data: festival, error } = await supabase
    .from("festivals")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !festival) return notFound();

  return (
    <div className="container mx-auto max-w-2xl py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black uppercase italic text-white">Edit Festival</h1>
          <p className="text-sm text-base-content/60">{festival.label}</p>
        </div>
        <Link href="/admin/festivals" className="btn btn-ghost btn-sm">
          Cancel
        </Link>
      </div>

      {/* UPDATE FORM */}
      <div className="card bg-base-100 shadow-xl border border-white/5">
        <div className="card-body">
          <form action={updateFestivalAction} className="space-y-4">
            <input type="hidden" name="id" value={festival.id} />

            <div className="form-control">
              <label className="label font-bold">Label / Name</label>
              <input 
                name="label" 
                defaultValue={festival.label} 
                className="input input-bordered" 
                required 
              />
            </div>

            <div className="form-control">
              <label className="label font-bold">City (Optional)</label>
              <input 
                name="city" 
                defaultValue={festival.city || ""} 
                className="input input-bordered" 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label font-bold">Start Date</label>
                <input 
                  type="date" 
                  name="start_date" 
                  defaultValue={festival.start_date} 
                  className="input input-bordered" 
                  required 
                />
              </div>

              <div className="form-control">
                <label className="label font-bold">End Date</label>
                <input 
                  type="date" 
                  name="end_date" 
                  defaultValue={festival.end_date} 
                  className="input input-bordered" 
                  required 
                />
              </div>
            </div>

            <div className="card-actions justify-end mt-4">
              <button type="submit" className="btn btn-primary font-bold">
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* DELETE SECTION */}
      <div className="card bg-red-950/20 border border-red-900/50 shadow-xl">
        <div className="card-body">
          <h3 className="card-title text-red-500 text-sm uppercase font-black">Danger Zone</h3>
          <p className="text-xs text-red-400/80 mb-4">
            Deleting this festival is permanent.
          </p>
          <form action={deleteFestivalAction}>
            <input type="hidden" name="id" value={festival.id} />
            <button 
                type="submit" 
                className="btn btn-error btn-outline btn-sm"
                // Standard browser confirm dialog
                // Note: In Server Actions, handling 'confirm' strictly usually requires a client component wrapper,
                // but this button works as a simple trigger.
            >
              Delete Festival
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}