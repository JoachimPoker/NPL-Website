import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import BadgeMedal from "@/components/badges/BadgeMedal";
import { type BadgeDefinition, CONDITION_LABEL, TIER_LABEL, conditionField } from "@/lib/badges";
import { awardBadgeAction, recalculateBadgesAction, revokeAwardAction } from "./actions";
import PlayerPicker from "./PlayerPicker";

export const dynamic = "force-dynamic";

function ruleText(d: BadgeDefinition) {
  const { field } = conditionField(d.condition_type);
  const base = CONDITION_LABEL[d.condition_type] ?? d.condition_type;
  if (d.condition_type === "series_title") return d.description;
  if (field === "ranks") {
    const from = d.condition_value?.min_rank ?? 1;
    const to = d.condition_value?.max_rank ?? from;
    return `${base}: ${from === to ? `finish ${from}` : `finish ${from} to ${to}`}`;
  }
  if (field === "min") {
    const v = Number(d.condition_value?.min ?? 1);
    const money = d.condition_type === "money" || d.condition_type === "biggest_cash";
    return `${base}: at least ${money ? `£${v.toLocaleString("en-GB")}` : v.toLocaleString("en-GB")}`;
  }
  return base;
}

export default async function AdminBadgesPage(props: { searchParams: Promise<{ recalc?: string; awarded?: string }> }) {
  const sp = await props.searchParams;
  let recalc: { awarded: number; removed: number; total: number } | null = null;
  try { recalc = sp.recalc ? JSON.parse(sp.recalc) : null; } catch {}

  const supabase = await createSupabaseServerClient();
  const [{ data: defs }, { data: stats }, { data: manual }] = await Promise.all([
    supabase.from("badge_definitions").select("*").order("display_order"),
    supabase.from("badge_stats").select("key, holders, awards"),
    supabase
      .from("player_badges")
      .select("id, badge_name, awarded_at, awarded_by, player:players(id, forename, surname)")
      .neq("awarded_by", "auto")
      .order("awarded_at", { ascending: false })
      .limit(20),
  ]);
  const statByKey = new Map((stats || []).map((s: any) => [s.key, s]));
  const badges = (defs || []) as BadgeDefinition[];
  const groups = [
    { title: "Badges (titles)", items: badges.filter((d) => d.kind === "badge") },
    { title: "Achievements (milestones)", items: badges.filter((d) => d.kind !== "badge") },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      <div className="flex flex-col gap-4 border-b border-base-content/[0.07] pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="eyebrow mb-2 text-primary">Admin</div>
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Badges</h1>
          <p className="max-w-2xl text-sm text-base-content/60">
            Automatic badges are recalculated after every import. Season honours are given once a season is no longer
            active. Special badges are only ever awarded by hand.
          </p>
        </div>
        <div className="flex gap-2">
          <form action={recalculateBadgesAction}>
            <button className="btn btn-outline btn-sm">Recalculate</button>
          </form>
          <Link href="/admin/badges/new" className="btn btn-primary btn-sm">+ New badge</Link>
        </div>
      </div>

      {recalc && (
        <div role="status" className="alert alert-success text-sm">
          Recalculated: {recalc.awarded} badges awarded, {recalc.removed} removed ({recalc.total.toLocaleString("en-GB")} in total).
        </div>
      )}
      {sp.awarded && <div role="status" className="alert alert-success text-sm">Badge awarded.</div>}

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {groups.map((g) => (
            <div key={g.title} className="panel overflow-hidden">
              <h2 className="border-b border-base-content/[0.07] px-4 py-3 font-display text-lg font-semibold">{g.title}</h2>
              <table className="table table-sm w-full">
                <thead className="bg-base-200/50 text-[10px] uppercase">
                  <tr><th>Name</th><th className="hidden md:table-cell">Rule</th><th className="text-right">Holders</th></tr>
                </thead>
                <tbody>
                  {g.items.map((d) => (
                    <tr key={d.id} className={`hover:bg-base-200/30 ${d.is_active ? "" : "opacity-40"}`}>
                      <td>
                        <Link href={`/admin/badges/${d.id}`} className="flex items-center gap-3 hover:text-primary">
                          <BadgeMedal tier={d.tier} icon={d.icon} imageUrl={d.image_url} size="sm" />
                          <span>
                            <span className="block font-semibold">{d.name}</span>
                            <span className="block text-[11px] opacity-50">{d.category}{d.kind === "badge" ? "" : ` · ${TIER_LABEL[d.tier]}`}{d.is_active ? "" : " · inactive"}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="hidden text-xs opacity-70 md:table-cell">{ruleText(d)}</td>
                      <td className="text-right font-mono">{(statByKey.get(d.key)?.holders ?? 0).toLocaleString("en-GB")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        <div className="space-y-6">
          <form action={awardBadgeAction} className="panel">
            <div className="card-body space-y-3 p-5">
              <h2 className="font-display text-lg font-semibold">Award a badge</h2>
              <PlayerPicker />
              <select name="badge_key" required className="select select-bordered select-sm" aria-label="Badge" defaultValue="">
                <option value="" disabled>Choose a badge…</option>
                {badges.filter((d) => d.is_active && d.kind === "badge").map((d) => (
                  <option key={d.key} value={d.key}>{d.condition_type === "special" ? "★ " : ""}{d.name}</option>
                ))}
              </select>
              <input name="occasion" placeholder="Occasion (optional), e.g. Sep 2026" className="input input-bordered input-sm" aria-label="Occasion" />
              <button className="btn btn-primary btn-sm">Award</button>
              <p className="text-[11px] text-base-content/50">
                Use an occasion for badges someone can win more than once, like Player of the Month.
              </p>
            </div>
          </form>

          <div className="panel">
            <div className="card-body p-5">
              <h2 className="font-display text-lg font-semibold">Awarded by hand</h2>
              {manual?.length ? (
                <ul className="divide-y divide-base-content/[0.06] text-sm">
                  {manual.map((m: any) => (
                    <li key={m.id} className="flex items-center justify-between gap-2 py-2">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{m.badge_name}</span>
                        <span className="block truncate text-xs opacity-50">
                          {m.player ? `${m.player.forename} ${m.player.surname}` : "—"} · {m.awarded_at ? new Date(m.awarded_at).toLocaleDateString("en-GB") : ""}
                        </span>
                      </span>
                      <form action={revokeAwardAction}>
                        <input type="hidden" name="award_id" value={m.id} />
                        <button className="btn btn-ghost btn-xs text-error">Remove</button>
                      </form>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs opacity-60">None yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
