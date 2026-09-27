import {
  Award, CalendarDays, Club, Coins, Crown, Diamond, Dice5, Flag, Flame, Gem, Gift, Heart, Landmark, MapPin, Medal, Mountain,
  Shield, ShieldCheck, Spade, Sparkles, Star, Swords, Target, Trophy, Zap,
  type LucideIcon,
} from "lucide-react";
import type { BadgeTier } from "@/lib/badges";

export const BADGE_ICONS: Record<string, LucideIcon> = {
  trophy: Trophy, coins: Coins, target: Target, gem: Gem, map: MapPin, crown: Crown, star: Star, swords: Swords,
  sparkles: Sparkles, medal: Medal, shield: Shield, flame: Flame, zap: Zap, heart: Heart, calendar: CalendarDays, award: Award,
  diamond: Diamond, "shield-check": ShieldCheck, spade: Spade, club: Club, dice: Dice5, landmark: Landmark,
  mountain: Mountain, flag: Flag, gift: Gift,
};

// Metal for each tier: a two-stop gradient face, a rim, and an icon colour.
const TIERS: Record<BadgeTier, { face: string; rim: string; icon: string; glow: string }> = {
  bronze: {
    face: "linear-gradient(145deg, oklch(66% 0.09 55), oklch(44% 0.08 45))",
    rim: "oklch(74% 0.08 60)", icon: "oklch(96% 0.03 70)", glow: "oklch(60% 0.09 55 / 0.35)",
  },
  silver: {
    face: "linear-gradient(145deg, oklch(88% 0.01 250), oklch(60% 0.015 250))",
    rim: "oklch(94% 0.008 250)", icon: "oklch(28% 0.02 250)", glow: "oklch(85% 0.01 250 / 0.3)",
  },
  gold: {
    face: "linear-gradient(145deg, oklch(86% 0.12 88), oklch(64% 0.12 70))",
    rim: "oklch(92% 0.1 90)", icon: "oklch(30% 0.06 65)", glow: "oklch(79% 0.115 78 / 0.4)",
  },
  emerald: {
    face: "linear-gradient(145deg, oklch(78% 0.15 158), oklch(50% 0.13 162))",
    rim: "oklch(86% 0.11 158)", icon: "oklch(97% 0.03 160)", glow: "oklch(66% 0.15 158 / 0.4)",
  },
  diamond: {
    face: "linear-gradient(145deg, oklch(95% 0.045 215), oklch(72% 0.1 222))",
    rim: "oklch(98% 0.03 210)", icon: "oklch(34% 0.08 230)", glow: "oklch(85% 0.09 215 / 0.45)",
  },
  purple: {
    face: "linear-gradient(145deg, oklch(70% 0.17 305), oklch(45% 0.18 290))",
    rim: "oklch(80% 0.13 310)", icon: "oklch(97% 0.02 300)", glow: "oklch(62% 0.18 300 / 0.45)",
  },
};

const SIZES = { sm: { box: 36, icon: 16 }, md: { box: 56, icon: 24 }, lg: { box: 88, icon: 38 } } as const;

/** Round medal for a badge. `locked` renders a grey, not-yet-earned version. */
export default function BadgeMedal({
  tier, icon, imageUrl, size = "md", locked = false, label,
}: {
  tier: BadgeTier;
  icon?: string | null;
  imageUrl?: string | null;
  size?: keyof typeof SIZES;
  locked?: boolean;
  label?: string;
}) {
  const t = TIERS[tier] ?? TIERS.bronze;
  const s = SIZES[size];
  const Icon = BADGE_ICONS[icon ?? ""] ?? Award;

  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      // Not earned yet: the same colours, faded (so a level keeps its colour everywhere).
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full ${locked ? "opacity-40" : ""}`}
      style={{
        width: s.box,
        height: s.box,
        background: t.face,
        boxShadow: locked
          ? `inset 0 0 0 2px ${t.rim}, inset 0 -6px 12px oklch(0% 0 0 / 0.25)`
          : `inset 0 0 0 2px ${t.rim}, inset 0 -6px 12px oklch(0% 0 0 / 0.25), 0 6px 18px -6px ${t.glow}`,
      }}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="h-[72%] w-[72%] rounded-full object-cover" />
      ) : (
        <Icon size={s.icon} strokeWidth={2.2} style={{ color: t.icon }} aria-hidden="true" />
      )}
    </span>
  );
}
