import {
  Award, CalendarDays, Club, Coins, Crown, Diamond, Dice5, Flag, Flame, Gem, Gift, Heart, Landmark, MapPin, Medal, Mountain,
  Shield, ShieldCheck, Spade, Sparkles, Star, Swords, Target, Trophy, Zap,
  type LucideIcon,
} from "lucide-react";
import type { BadgeDefinition, BadgeTier } from "@/lib/badges";
import { levelOf, sealText, type SealText } from "@/lib/badgeSeal";

/** Lucide icons by name. Badges are drawn as seals now; these remain for small inline title chips and admin. */
export const BADGE_ICONS: Record<string, LucideIcon> = {
  trophy: Trophy, coins: Coins, target: Target, gem: Gem, map: MapPin, crown: Crown, star: Star, swords: Swords,
  sparkles: Sparkles, medal: Medal, shield: Shield, flame: Flame, zap: Zap, heart: Heart, calendar: CalendarDays, award: Award,
  diamond: Diamond, "shield-check": ShieldCheck, spade: Spade, club: Club, dice: Dice5, landmark: Landmark,
  mountain: Mountain, flag: Flag, gift: Gift,
};

const AMBER = "#f2a33a";
const INK = "#f3ede4";

/** Achievement levels: rim and ring-text colour, then the face gradient (light, mid, dark). */
const LEVELS: Record<number, [string, string, string, string]> = {
  1: ["#d08c5c", "#2c2017", "#1f1a14", "#15130f"], // Bronze
  2: ["#cfd7dc", "#24313a", "#18232a", "#10191e"], // Silver
  3: ["#ecc65a", "#2f2a12", "#22200f", "#17160b"], // Gold
  4: ["#45d394", "#0f3a2b", "#0b2c21", "#071f17"], // Emerald
  5: ["#93dcff", "#123247", "#0c2536", "#081a27"], // Diamond
  6: [AMBER, "#4a2a72", "#331a55", "#22103b"], // Legendary
};
const TITLE: [string, string, string, string] = [AMBER, "#11353a", "#0b2629", "#081e21"];

const SIZES = { sm: 36, md: 56, lg: 88 } as const;

/** Rough width of bold caps in seal units, to shrink text that would overrun. */
function textWidth(text: string, size: number, spacing = 0) {
  const narrow = [...text].filter((c) => "1I/ .·".includes(c)).length;
  return (text.length - narrow) * 0.64 * size + narrow * 0.34 * size + Math.max(text.length - 1, 0) * spacing;
}

/** Stable id for the text paths, so identical seals on one page share the same (identical) definitions. */
function hashId(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return `seal${(h >>> 0).toString(36)}`;
}

function RingText({ id, d, text, fill }: { id: string; d: string; text: string; fill: string }) {
  let size = 4.4;
  let spacing = 1.15;
  while (textWidth(text, size, spacing) > 62 && size > 3.2) {
    size -= 0.15;
    spacing = Math.max(spacing - 0.05, 0.4);
  }
  return (
    <>
      <path id={id} d={d} fill="none" />
      <text fontSize={size} fontWeight={700} letterSpacing={spacing} fill={fill} fillOpacity={0.9} textAnchor="middle">
        <textPath href={`#${id}`} startOffset="50%">{text}</textPath>
      </text>
    </>
  );
}

/** A struck seal: ring text, the name or number in the middle, level pips for achievements. */
export function Seal({ seal, px, locked = false, label }: { seal: SealText; px: number; locked?: boolean; label?: string }) {
  const achievement = seal.kind === "achievement";
  const [rim, f1, f2, f3] = achievement ? LEVELS[seal.level] ?? LEVELS[1] : TITLE;
  const compact = px <= 44;
  const id = hashId(`${seal.kind}${seal.level}${seal.top}${seal.centre}${seal.sub}${seal.bottom}`);
  const doubleRim = !achievement || seal.level >= 4;
  const ringFill = achievement ? rim : INK;

  let size = compact ? 17 : 15.5;
  while (textWidth(seal.centre, size, -0.3) > (compact ? 34 : 30) && size > 7) size -= 0.25;
  const showSub = !!seal.sub && !(compact && achievement);
  const centreY = 32 + size * 0.36 - (showSub || achievement ? 3 : 0);
  let subSize = compact ? 4.6 : 3.7;
  const subW = textWidth(seal.sub, subSize, 0.9);
  if (subW > 26) subSize *= 26 / subW;

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 64 64"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className="shrink-0"
      style={{ opacity: locked ? 0.4 : undefined, fontFamily: "inherit" }}
    >
      <defs>
        <radialGradient id={`${id}f`} cx="38%" cy="30%" r="80%">
          <stop offset="0" stopColor={f1} />
          <stop offset=".65" stopColor={f2} />
          <stop offset="1" stopColor={f3} />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="31.4" fill={`url(#${id}f)`} />
      <circle cx="32" cy="32" r="30.6" fill="none" stroke={rim} strokeWidth="1.1" strokeDasharray={locked ? "2 2.4" : undefined} />
      {doubleRim && <circle cx="32" cy="32" r="29.2" fill="none" stroke={rim} strokeWidth="0.45" />}
      {/* Beaded edge of the centre field. */}
      <circle cx="32" cy="32" r="21.4" fill="none" stroke={rim} strokeWidth="0.9" strokeDasharray="0.01 1.62" strokeLinecap="round" />
      {!compact && (
        <>
          <RingText id={`${id}t`} d="M 7.4 32 A 24.6 24.6 0 0 1 56.6 32" text={seal.top} fill={ringFill} />
          <RingText id={`${id}b`} d="M 5.2 32 A 26.8 26.8 0 0 0 58.8 32" text={seal.bottom} fill={ringFill} />
          {[5.6, 58.4].map((x) => <path key={x} d={`M${x} 30.6 L${x + 1.4} 32 L${x} 33.4 L${x - 1.4} 32 Z`} fill={rim} />)}
        </>
      )}
      <text x="32" y={centreY} fontSize={size} fontWeight={800} letterSpacing={-0.3} fill={INK} textAnchor="middle">{seal.centre}</text>
      {showSub && (
        <text x="32" y={centreY + 6.6} fontSize={subSize} fontWeight={700} letterSpacing={0.9} fill={rim} textAnchor="middle">{seal.sub}</text>
      )}
      {achievement &&
        Array.from({ length: seal.pips ?? seal.level }, (_, i) => {
          const x = 32 + (i - ((seal.pips ?? seal.level) - 1) / 2) * 3.3;
          const y = centreY + 6.2;
          return <path key={i} d={`M${x} ${y - 1.15} L${x + 1.15} ${y} L${x} ${y + 1.15} L${x - 1.15} ${y} Z`} fill={rim} />;
        })}
    </svg>
  );
}

/**
 * Badge medal. Pass `def` to draw the badge's seal (with `year` / `awardedAt` from a player's award);
 * uploaded artwork (`image_url`) still replaces it. Without `def`, falls back to an icon medal (admin icon picker).
 */
export default function BadgeMedal({
  def, year, awardedAt, tier = "gold", icon, imageUrl, size = "md", locked = false, label,
}: {
  def?: BadgeDefinition | null;
  year?: number | null;
  awardedAt?: string | null;
  tier?: BadgeTier;
  icon?: string | null;
  imageUrl?: string | null;
  size?: keyof typeof SIZES;
  locked?: boolean;
  label?: string;
}) {
  const px = SIZES[size];
  const image = imageUrl ?? def?.image_url ?? null;

  if (def && !image) {
    return <Seal seal={sealText(def, { year, awardedAt })} px={px} locked={locked} label={label} />;
  }

  const [rim, f1, f2] = def?.kind === "achievement" ? LEVELS[levelOf(def.tier)] ?? TITLE : def ? TITLE : LEVELS[levelOf(tier)] ?? TITLE;
  const Icon = BADGE_ICONS[icon ?? def?.icon ?? ""] ?? Award;
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full ${locked ? "opacity-40" : ""}`}
      style={{ width: px, height: px, background: `radial-gradient(circle at 38% 30%, ${f1}, ${f2})`, boxShadow: `inset 0 0 0 1.5px ${rim}` }}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="h-[78%] w-[78%] rounded-full object-cover" />
      ) : (
        <Icon size={Math.round(px * 0.43)} strokeWidth={2} style={{ color: rim }} aria-hidden="true" />
      )}
    </span>
  );
}
