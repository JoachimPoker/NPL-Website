import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { addPrizeAction, deletePrizeAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function SeasonPrizesPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const seasonId = Number(id);
  if (!Number.isFinite(seasonId)) notFound();

  const supabase = await createSupabaseServerClient();
  const [{ data: season }, { data: leagues }, { data: prizes }] = await Promise.all([
    supabase.from("seasons").select("id, name").eq("id", seasonId).maybeSingle(),
    supabase.from("leagues").select("slug, label").eq("season_id", seasonId).order("id"),
    supabase.from("season_prizes").select("*").eq("season_id", seasonId).order("position_from"),
  ]);
  if (!season) notFound();

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      <div className="flex flex-col gap-4 border-b border-base-content/[0.07] pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <Link href={`/admin/seasons/${season.id}`} className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-[0.9375rem] font-medium text-season-ink/75 hover:text-season-ink"><span aria-hidden="true">←</span> {season.name}</Link>
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Prizes</h1>
          <p className="text-sm text-base-content/60">
            Shown next to each position on the Leaderboards page, with a line under the last paid place.
          </p>
        </div>
        <Link href="/admin/seasons" className="btn btn-ghost btn-sm">← Seasons</Link>
      </div>

      {[...(leagues || [])]
        .sort((a, b) => (({ npl: 0, hrl: 1, lrl: 2 } as Record<string, number>)[a.slug] ?? 3) - (({ npl: 0, hrl: 1, lrl: 2 } as Record<string, number>)[b.slug] ?? 3))
        .map((l) => {
        const rows = (prizes || []).filter((p) => p.league === l.slug);
        return (
          <section key={l.slug} className="panel overflow-hidden">
            <h2 className="font-display font-semibold border-b border-base-content/[0.07] px-5 py-3">{l.label}</h2>
            <table className="table table-sm w-full">
              <thead className="bg-base-200/50 text-[0.8125rem]">
                <tr><th>Position</th><th>Prize</th><th className="text-right">Amount</th><th /></tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td className="font-mono">{p.position_from === p.position_to ? p.position_from : `${p.position_from}–${p.position_to}`}</td>
                    <td>{p.prize_description}</td>
                    <td className="text-right font-mono">{p.prize_amount ? `£${Number(p.prize_amount).toLocaleString("en-GB")}` : "–"}</td>
                    <td className="text-right">
                      <form action={deletePrizeAction}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="season_id" value={seasonId} />
                        <button className="btn btn-ghost btn-xs text-error">Remove</button>
                      </form>
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr><td colSpan={4} className="py-4 text-center text-xs opacity-50">No prizes yet.</td></tr>
                )}
              </tbody>
            </table>

            <form action={addPrizeAction} className="flex flex-wrap items-end gap-3 border-t border-base-content/[0.07] bg-base-200/30 p-4">
              <input type="hidden" name="season_id" value={seasonId} />
              <input type="hidden" name="league" value={l.slug} />
              <label className="form-control w-20">
                <span className="label-text mb-1 text-[11px] font-bold">From</span>
                <input name="position_from" type="number" min={1} required className="input input-bordered input-sm" />
              </label>
              <label className="form-control w-20">
                <span className="label-text mb-1 text-[11px] font-bold">To</span>
                <input name="position_to" type="number" min={1} className="input input-bordered input-sm" placeholder="same" />
              </label>
              <label className="form-control min-w-48 flex-1">
                <span className="label-text mb-1 text-[11px] font-bold">Prize</span>
                <input name="prize_description" className="input input-bordered input-sm" placeholder="e.g. Trophy + £2,000 GUKPT package" />
              </label>
              <label className="form-control w-32">
                <span className="label-text mb-1 text-[11px] font-bold">Value (£)</span>
                <input name="prize_amount" type="number" min={0} step="1" className="input input-bordered input-sm" />
              </label>
              <button className="btn btn-primary btn-sm">Add</button>
            </form>
          </section>
        );
      })}
    </div>
  );
}
