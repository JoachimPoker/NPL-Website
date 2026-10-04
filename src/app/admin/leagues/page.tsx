import { createSupabaseServerClient } from "@/lib/supabaseServer";
import ImageField from "@/components/admin/ImageField";
import { saveLeagueBrandAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminLeaguesPage() {
  const supabase = await createSupabaseServerClient();
  const { data: rows, error } = await supabase.from("league_brands").select("*");
  const rank = (slug: string) => ({ npl: 0, hrl: 1, lrl: 2 } as Record<string, number>)[slug] ?? 3;
  const brands = [...(rows || [])].sort((a, b) => rank(a.slug) - rank(b.slug));

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      <div className="border-b border-base-content/[0.07] pb-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">League logos</h1>
        <p className="max-w-2xl text-sm text-base-content/60">
          One logo per league, used for every season: on the leaderboards, the home page and the Hall of Fame.
          Wide banner logos work best (PNG or SVG, transparent or solid background).
        </p>
      </div>

      {error && (
        <div className="alert alert-warning text-sm">
          League logos aren&apos;t set up yet. Run the migration <code>20260927170000_league_brands.sql</code> first.
        </div>
      )}

      <div className="space-y-4">
        {(brands || []).map((b) => (
          <form key={b.slug} action={saveLeagueBrandAction} className="panel">
            <div className="card-body gap-4 p-5">
              <input type="hidden" name="slug" value={b.slug} />
              <h2 className="font-display text-lg font-semibold">{b.name}</h2>
              <ImageField name="logo_url" folder="logos" label="Logo" defaultValue={b.logo_url ?? ""} />
              <div>
                <button className="btn btn-primary btn-sm">Save</button>
              </div>
            </div>
          </form>
        ))}
      </div>
    </div>
  );
}
