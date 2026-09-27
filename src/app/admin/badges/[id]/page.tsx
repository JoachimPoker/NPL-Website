import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import ImageField from "@/components/admin/ImageField";
import BadgeMedal, { BADGE_ICONS } from "@/components/badges/BadgeMedal";
import { type BadgeDefinition, ACHIEVEMENTS, ACHIEVEMENT_CONDITIONS, BADGE_CATEGORY_ORDER, BADGE_CONDITIONS, CONDITION_LABEL, conditionField } from "@/lib/badges";
import { saveBadgeAction } from "../actions";

export const dynamic = "force-dynamic";

const CATEGORIES = [...BADGE_CATEGORY_ORDER, ...ACHIEVEMENTS.map((a) => a.title)];

export default async function AdminBadgeEditPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const isNew = id === "new";

  let d: BadgeDefinition | null = null;
  if (!isNew) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.from("badge_definitions").select("*").eq("id", Number(id)).maybeSingle();
    if (!data) notFound();
    d = data as BadgeDefinition;
  }
  const type = d?.condition_type ?? "special";
  const { field } = conditionField(type);
  const threshold = field === "min" ? d?.condition_value?.min ?? "" : "";
  const minRank = d?.condition_value?.min_rank ?? 1;
  const maxRank = d?.condition_value?.max_rank ?? d?.condition_value?.min_rank ?? 1;
  const isSeriesTitle = type === "series_title";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      <div className="flex items-end justify-between border-b border-base-content/[0.07] pb-6">
        <div className="flex items-center gap-4">
          {d && <BadgeMedal tier={d.tier} icon={d.icon} imageUrl={d.image_url} size="lg" />}
          <div>
            <div className="eyebrow mb-2 text-primary">Badges</div>
            <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{isNew ? "New badge" : d!.name}</h1>
          </div>
        </div>
        <Link href="/admin/badges" className="btn btn-ghost btn-sm">← All badges</Link>
      </div>

      <form action={saveBadgeAction} className="space-y-5">
        {!isNew && <input type="hidden" name="id" value={d!.id} />}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="form-control">
            <span className="label-text mb-1 text-xs font-bold">Name</span>
            <input name="name" required defaultValue={d?.name ?? ""} className="input input-bordered input-sm" />
          </label>
          {isNew ? (
            <label className="form-control">
              <span className="label-text mb-1 text-xs font-bold">Key (optional)</span>
              <input name="key" placeholder="made from the name" className="input input-bordered input-sm font-mono" />
            </label>
          ) : (
            <div className="form-control">
              <span className="label-text mb-1 text-xs font-bold">Key</span>
              <code className="rounded bg-base-200 px-3 py-1.5 text-sm">{d!.key}</code>
            </div>
          )}
        </div>

        <label className="form-control">
          <span className="label-text mb-1 text-xs font-bold">Description</span>
          <input name="description" required defaultValue={d?.description ?? ""} className="input input-bordered input-sm" placeholder="How to earn it, e.g. Win 3 league events." />
        </label>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="form-control">
            <span className="label-text mb-1 text-xs font-bold">Category</span>
            <input name="category" list="badge-categories" defaultValue={d?.category ?? "Special"} className="input input-bordered input-sm" />
            <datalist id="badge-categories">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
          </label>
          <label className="form-control">
            <span className="label-text mb-1 text-xs font-bold">Tier (achievements only)</span>
            <select name="tier" defaultValue={d?.tier ?? "bronze"} disabled={d?.kind === "badge"} className="select select-bordered select-sm">
              <option value="bronze">Bronze</option>
              <option value="silver">Silver</option>
              <option value="gold">Gold</option>
              <option value="emerald">Emerald</option>
              <option value="diamond">Diamond</option>
              <option value="purple">Legendary</option>
            </select>
          </label>
          <label className="form-control">
            <span className="label-text mb-1 text-xs font-bold">Rarity label</span>
            <select name="rarity" defaultValue={d?.rarity ?? "common"} className="select select-bordered select-sm">
              {["common", "uncommon", "rare", "epic", "legendary", "mythic"].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
        </div>

        {isSeriesTitle ? (
          <div className="rounded-lg bg-base-200/60 p-4 text-sm">
            <input type="hidden" name="condition_type" value="series_title" />
            <span className="font-semibold">Series title.</span>{" "}
            <span className="text-base-content/60">
              Set up automatically for its series: won by the festival&apos;s Main Event winner (or any tournament winner for series
              without festivals). You can rename it, change its tier or switch it off.
            </span>
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="form-control md:col-span-1">
                <span className="label-text mb-1 text-xs font-bold">How it&apos;s earned</span>
                <select name="condition_type" defaultValue={type} className="select select-bordered select-sm">
                  <optgroup label="Achievements (a number to reach)">
                    {ACHIEVEMENT_CONDITIONS.map((t) => <option key={t} value={t}>{CONDITION_LABEL[t]}</option>)}
                  </optgroup>
                  <optgroup label="Badges (titles won)">
                    {BADGE_CONDITIONS.map((t) => <option key={t} value={t}>{CONDITION_LABEL[t]}</option>)}
                  </optgroup>
                </select>
              </label>
              <label className="form-control">
                <span className="label-text mb-1 text-xs font-bold">At least (achievements)</span>
                <input name="threshold" type="number" min={1} step="any" defaultValue={threshold} className="input input-bordered input-sm" placeholder="e.g. 25 cashes, 50000 (£)" />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="form-control">
                  <span className="label-text mb-1 text-xs font-bold">From position</span>
                  <input name="min_rank" type="number" min={1} defaultValue={minRank} className="input input-bordered input-sm" />
                </label>
                <label className="form-control">
                  <span className="label-text mb-1 text-xs font-bold">To position</span>
                  <input name="max_rank" type="number" min={1} defaultValue={maxRank} className="input input-bordered input-sm" />
                </label>
              </div>
            </div>
            <p className="-mt-2 text-[11px] text-base-content/50">
              Achievements use &ldquo;at least&rdquo; (money in pounds). League titles use a range of finishing positions:
              1 to 1 for champion, 2 to 3 for podium. &ldquo;Awarded by hand&rdquo; needs neither. Saving recalculates who has it.
            </p>
          </>
        )}

        <fieldset>
          <legend className="label-text mb-2 text-xs font-bold">Icon</legend>
          <div className="flex flex-wrap gap-2">
            {Object.keys(BADGE_ICONS).map((icon) => (
              <label key={icon} className="cursor-pointer" title={icon}>
                <input type="radio" name="icon" value={icon} defaultChecked={(d?.icon ?? "award") === icon} className="peer sr-only" />
                <span className="flex rounded-full p-1 ring-2 ring-transparent peer-checked:ring-primary peer-focus-visible:ring-primary/60">
                  <BadgeMedal tier={d?.tier ?? "gold"} icon={icon} size="sm" />
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <ImageField name="image_url" folder="badges" label="Custom artwork (optional, replaces the icon)" defaultValue={d?.image_url ?? ""} />

        <div className="flex flex-wrap items-center gap-6">
          <label className="form-control w-32">
            <span className="label-text mb-1 text-xs font-bold">Order</span>
            <input name="display_order" type="number" defaultValue={d?.display_order ?? 100} className="input input-bordered input-sm" />
          </label>
          {!isNew && (
            <label className="label cursor-pointer gap-3 pt-5">
              <input type="checkbox" name="is_active" defaultChecked={d?.is_active ?? true} className="toggle toggle-success toggle-sm" />
              <span className="label-text">Active (inactive badges are hidden, and their automatic awards are removed)</span>
            </label>
          )}
        </div>

        <div className="flex gap-3">
          <button className="btn btn-primary">Save</button>
          <Link href="/admin/badges" className="btn btn-ghost">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
