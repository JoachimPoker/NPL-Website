import Medal from "@/components/badges/Medal";
import type { TitleIcon } from "@/lib/leaderboards";

/**
 * The titles a player holds, as small struck seals beside their name in a table (all of them unless a max
 * is given, then "+N"). A title won more than once carries its count.
 */
export default function TitleSeals({ titles, max = 99, size = 28, className = "" }: { titles: TitleIcon[]; max?: number; size?: number; className?: string }) {
  if (!titles.length) return null;
  return (
    <span className={`flex shrink-0 items-center gap-1 ${className}`}>
      {titles.slice(0, max).map((t) => {
        const label = `${t.name}${t.count > 1 ? ` ×${t.count}` : ""}`;
        return (
          <span key={t.key} title={label} aria-label={label} role="img" className="relative inline-flex">
            <Medal def={t.def} size={size} />
            {t.count > 1 && (
              <span aria-hidden="true" className="absolute -right-1 -top-1 rounded-full bg-season-amber px-1 py-px text-[0.6875rem] font-bold leading-none tabular-nums text-season-amber-ink">
                {t.count}
              </span>
            )}
          </span>
        );
      })}
      {titles.length > max && (
        <span className="text-[0.8125rem] tabular-nums text-season-muted" title={titles.slice(max).map((t) => t.name).join(", ")}>
          +{titles.length - max}
        </span>
      )}
    </span>
  );
}
