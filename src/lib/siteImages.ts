// src/lib/siteImages.ts
// Every replaceable photo on the site. Admins upload replacements at /admin/images; until they do (or if the
// site_images table isn't there yet) each spot shows its built-in default, a generated stand-in.
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export type SiteImageKey =
  | "home_hero" | "home_week"
  | "room_1" | "room_2" | "room_3"
  | "leaderboards_hero" | "tournaments_hero" | "players_hero" | "profile_hero" | "venues_hero" | "hall_of_fame_hero"
  | "plaque_marble";

export type SiteImageSlot = { key: SiteImageKey; label: string; where: string; fallback: string; shape: string };

export const SITE_IMAGE_GROUPS: { title: string; note: string; slots: SiteImageSlot[] }[] = [
  {
    title: "Home page",
    note: "The first things visitors see.",
    slots: [
      { key: "home_hero", label: "Home hero", where: "Top of the home page, and behind the News lead story when it has no photo", fallback: "/home/hero-film.png", shape: "2400 × 1000 px (12:5). Subject centre-right and in the upper half: the bottom fades to dark, and phones crop to the middle." },
      { key: "home_week", label: "This week band", where: "Behind “This week” on the home page", fallback: "/home/week-band.png", shape: "2400 × 800 px (3:1). Keep the right half calm: the three climb figures sit there." },
    ],
  },
  {
    title: "Section photos",
    note: "The photo across the top of each section. The left side is darkened behind the title, so keep the subject centre-right.",
    slots: [
      { key: "leaderboards_hero", label: "Leaderboards", where: "Leaderboards page", fallback: "/leaderboards/hero-hall.png", shape: "2400 × 800 px (3:1). Subject centre-right; the left side darkens behind the title." },
      { key: "tournaments_hero", label: "Tournaments", where: "Tournaments and About pages", fallback: "/events/hero-floor.png", shape: "2400 × 800 px (3:1). Subject centre-right; the left side darkens behind the title." },
      { key: "players_hero", label: "Players", where: "Players list and Compare", fallback: "/players/hero-seats.png", shape: "2400 × 800 px (3:1). Subject centre-right; the left side darkens behind the title." },
      { key: "profile_hero", label: "Player profile", where: "Every player profile, and the Badges page", fallback: "/players/hero-cabinet.png", shape: "2400 × 800 px (3:1). Subject centre-right; the left side darkens behind the title." },
      { key: "venues_hero", label: "Venues", where: "Venues list and every venue page", fallback: "/venues/hero-room.png", shape: "2400 × 800 px (3:1). Subject centre-right; the left side darkens behind the title." },
      { key: "hall_of_fame_hero", label: "Hall of Fame", where: "Hall of Fame page", fallback: "/hall-of-fame/hero-wall.png", shape: "2400 × 800 px (3:1). Shown zoomed in on the right third, so put the subject there." },
    ],
  },
  {
    title: "Room photos",
    note: "General event photos used in rotation wherever a festival or series has no photo of its own: festival tiles and result thumbnails (home page included), news without a photo, and series, festival and event pages.",
    slots: [
      { key: "room_1", label: "Room photo 1", where: "Thumbnails and page tops in rotation; also the “Coming up” strip", fallback: "/home/room-grand.png", shape: "2400 × 1350 px (16:9), subject centred: it's cropped to 16:9 tiles, small thumbnails and wide page tops." },
      { key: "room_2", label: "Room photo 2", where: "Thumbnails and page tops in rotation", fallback: "/home/room-modern.png", shape: "2400 × 1350 px (16:9), subject centred: it's cropped to 16:9 tiles, small thumbnails and wide page tops." },
      { key: "room_3", label: "Room photo 3", where: "Thumbnails and page tops in rotation", fallback: "/home/room-final.png", shape: "2400 × 1350 px (16:9), subject centred: it's cropped to 16:9 tiles, small thumbnails and wide page tops." },
    ],
  },
  {
    title: "Textures",
    note: "Surfaces rather than photos.",
    slots: [
      { key: "plaque_marble", label: "Plaque marble", where: "The champion plaques and record boxes on the Hall of Fame", fallback: "/hall-of-fame/marble.webp", shape: "1200 × 800 px or larger. A dark, even texture so text stays readable." },
    ],
  },
];

const SLOTS = SITE_IMAGE_GROUPS.flatMap((g) => g.slots);
export const DEFAULT_IMAGES = Object.fromEntries(SLOTS.map((s) => [s.key, s.fallback])) as Record<SiteImageKey, string>;

export type SiteImages = Record<SiteImageKey, string> & { rooms: string[] };

/** The site's current photos (replacements over defaults). Read once per request. */
export const getSiteImages = cache(async (): Promise<SiteImages> => {
  const out: Record<string, string> = { ...DEFAULT_IMAGES };
  try {
    const db = await createSupabaseServerClient();
    const { data, error } = await db.from("site_images" as any).select("key, url");
    if (!error) for (const r of (data || []) as unknown as { key: string; url: string }[]) if (r.url && r.key in out) out[r.key] = r.url;
  } catch {
    // Table not set up yet, or offline: the defaults stand.
  }
  const imgs = out as Record<SiteImageKey, string>;
  return { ...imgs, rooms: [imgs.room_1, imgs.room_2, imgs.room_3] };
});

/** Which uploaded replacements exist, for the admin page. */
export async function getSiteImageOverrides() {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.from("site_images" as any).select("key, url, updated_at");
  return { rows: ((data || []) as unknown as { key: string; url: string; updated_at: string }[]), missingTable: !!error };
}

/** Festival photos by festival id (empty until the festival photo column exists). Read once per request. */
export const getFestivalPhotos = cache(async (): Promise<Map<string, string>> => {
  try {
    const db = await createSupabaseServerClient();
    const { data, error } = await db.from("festivals").select("id, image_url" as any).not("image_url" as any, "is", null);
    if (error) return new Map();
    return new Map(((data || []) as unknown as { id: string; image_url: string }[]).map((r) => [String(r.id), r.image_url]));
  } catch {
    return new Map();
  }
});

/** Venue photos by venue (casino) name (empty until the venue photos table exists). Read once per request. */
export const getVenuePhotos = cache(async (): Promise<Map<string, string>> => {
  try {
    const db = await createSupabaseServerClient();
    const { data, error } = await db.from("venue_images" as any).select("casino, url");
    if (error) return new Map();
    return new Map(((data || []) as unknown as { casino: string; url: string }[]).map((r) => [r.casino, r.url]));
  } catch {
    return new Map();
  }
});
