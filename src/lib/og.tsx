import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_ALT = SITE_NAME;

// The Season palette (globals.css season-* tokens) in hex, since the image renderer has no CSS variables.
const C = {
  bg: "#06191c",
  glow: "#14434a",
  panel: "#0f3337",
  text: "#f3ede4",
  muted: "#93adac",
  gold: "#f2a33a", // the amber accent
  line: "rgba(255,255,255,0.10)",
};

// NPL Events logo as a data URI (the image renderer can't load site-relative URLs).
let logoCache: Promise<string | null> | null = null;
function logoDataUri() {
  logoCache ??= readFile(path.join(process.cwd(), "public", "brand", "NPL-Events-White.svg"))
    .then((b) => `data:image/svg+xml;base64,${b.toString("base64")}`)
    .catch(() => null);
  return logoCache;
}

// Brand heading font, fetched once per server instance. Falls back to the built-in font if offline.
let fontCache: Promise<ArrayBuffer | null> | null = null;
function headingFont() {
  fontCache ??= (async () => {
    try {
      const css = await (await fetch("https://fonts.googleapis.com/css2?family=Figtree:wght@700")).text();
      const src = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
      return src ? await (await fetch(src)).arrayBuffer() : null;
    } catch {
      return null;
    }
  })();
  return fontCache;
}

export type OgStat = { label: string; value: string };

/** The shared share-card layout: brand bar, eyebrow, big title, subtitle, up to four stats. */
export async function ogCard(opts: {
  eyebrow: string;
  title: string;
  subtitle?: string | null;
  stats?: OgStat[];
  rows?: { rank: string; name: string; value: string }[];
}) {
  const [font, logo] = await Promise.all([headingFont(), logoDataUri()]);
  const heading = font ? "Bricolage" : "sans-serif";
  const titleSize = opts.rows ? 64 : opts.title.length > 34 ? 60 : opts.title.length > 22 ? 76 : 92;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: `radial-gradient(circle at 12% 0%, ${C.glow} 0%, ${C.bg} 60%)`,
          color: C.text,
          padding: "56px 72px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Brand bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} width={243} height={60} alt="" />
            ) : (
              <div style={{ display: "flex", fontSize: 28, fontWeight: 600 }}>{SITE_NAME}</div>
            )}
          </div>
          <div style={{ display: "flex", fontSize: 22, color: C.muted }}>{SITE_TAGLINE}</div>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: opts.rows ? 36 : 72 }}>
          <div style={{ display: "flex", fontSize: 26, letterSpacing: 4, textTransform: "uppercase", color: C.gold }}>
            {opts.eyebrow}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 12,
              fontFamily: heading,
              fontWeight: 700,
              fontSize: titleSize,
              lineHeight: 1.02,
              letterSpacing: -2,
              maxWidth: 1050,
            }}
          >
            {opts.title}
          </div>
          {opts.subtitle && (
            <div style={{ display: "flex", marginTop: 16, fontSize: 30, color: C.muted, maxWidth: 1050 }}>{opts.subtitle}</div>
          )}
        </div>

        {/* Leaderboard rows */}
        {opts.rows && opts.rows.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 24, gap: 8 }}>
            {opts.rows.map((r, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "8px 22px",
                  borderRadius: 12,
                  background: i === 0 ? "rgba(242,163,58,0.14)" : C.panel,
                  fontSize: 26,
                }}
              >
                <div style={{ display: "flex", width: 56, color: i === 0 ? C.gold : C.muted, fontWeight: 700 }}>{r.rank}</div>
                <div style={{ display: "flex", flex: 1 }}>{r.name}</div>
                <div style={{ display: "flex", fontWeight: 700 }}>{r.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Stats */}
        {opts.stats && opts.stats.length > 0 && (
          <div style={{ display: "flex", marginTop: "auto", gap: 20 }}>
            {opts.stats.slice(0, 4).map((s) => (
              <div
                key={s.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  padding: "18px 24px",
                  borderRadius: 16,
                  background: C.panel,
                  border: `1px solid ${C.line}`,
                }}
              >
                <div style={{ display: "flex", fontSize: 20, letterSpacing: 2, textTransform: "uppercase", color: C.muted }}>
                  {s.label}
                </div>
                <div style={{ display: "flex", marginTop: 6, fontFamily: heading, fontWeight: 700, fontSize: 44 }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    ),
    { ...OG_SIZE, fonts: font ? [{ name: "Bricolage", data: font, weight: 700, style: "normal" }] : undefined }
  );
}

/** Full figures with commas, never "K" or "M" (brand book). */
export const gbpOg = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;
