import type { Metadata } from "next";

export const SITE_NAME = "National Poker League";
export const SITE_TAGLINE = "18+ · GambleAware.org";

/** Absolute site origin, used for canonical links, the sitemap and share images. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
).replace(/\/$/, "");

/**
 * Title, description, canonical URL and the Open Graph / X card text for a page.
 * Share images come from the nearest opengraph-image file, so none are set here.
 */
export function pageMeta(opts: { title: string; description?: string; path: string; noindex?: boolean }): Metadata {
  const { title, description, path, noindex } = opts;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, siteName: SITE_NAME, type: "website", locale: "en_GB" },
    twitter: { card: "summary_large_image", title, description },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}
