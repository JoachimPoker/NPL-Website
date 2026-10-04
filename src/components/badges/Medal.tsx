import { Seal } from "@/components/badges/BadgeMedal";
import { sealText } from "@/lib/badgeSeal";
import type { BadgeDefinition } from "@/lib/badges";

/**
 * A badge as a struck seal: its ring text, the short name or number in the middle, and level pips for
 * achievements (each level in its own metal). Uploaded artwork (`image_url`) replaces the seal. `year` comes
 * from a player's award (shown on the seal); `muted` is a level not reached, or a title nobody holds yet.
 */
export default function Medal({ def, size = 44, muted = false, year }: { def: BadgeDefinition; size?: number; muted?: boolean; year?: number | null }) {
  if (def.image_url) {
    return (
      <span
        aria-hidden="true"
        style={{ width: size, height: size }}
        className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full shadow-[inset_0_0_0_1px_rgb(242_163_58/0.75)] ${muted ? "opacity-40 grayscale" : ""}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={def.image_url} alt="" className="h-[78%] w-[78%] rounded-full object-cover" />
      </span>
    );
  }
  return <Seal seal={sealText(def, { year })} px={size} locked={muted} />;
}
