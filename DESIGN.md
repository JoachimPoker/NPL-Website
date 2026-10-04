---
name: National Poker League
description: The public record of the National Poker League, graded like a feature film.
colors:
  season-night: "#06191c"
  season-footer: "#041214"
  season-card: "#0f3337"
  season-card-lit: "#14434a"
  season-card-deep: "#0a2427"
  season-card-hover: "#123d42"
  season-scrollbar: "#1c4a4f"
  season-ink: "#f3ede4"
  season-white: "oklch(96.5% 0.012 85)"
  season-muted: "#93adac"
  season-amber: "#f2a33a"
  season-amber-hover: "#f6b45a"
  season-amber-ink: "#1a1206"
  season-up: "#4cc38a"
  season-down: "#f0605d"
typography:
  display:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 4.3vw, 5.5rem)"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.012em"
  page-title:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 4.4vw, 4.375rem)"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.012em"
  headline:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.875rem, 2.67vw, 2.75rem)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "0.01em"
  section:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 2vw, 1.875rem)"
    fontWeight: 600
    lineHeight: 1.15
  figure:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.75rem, 4.4vw, 4.75rem)"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "\"tnum\""
  leader:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.875rem, 12cqi, 3.25rem)"
    fontWeight: 600
    lineHeight: 1.04
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 2.4vw, 2.5rem)"
    fontWeight: 600
    lineHeight: 1.08
  lede:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.0625rem, 1.45vw, 1.375rem)"
    fontWeight: 500
    lineHeight: 1.5
  body:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.5
  meta:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.18em"
rounded:
  none: "0px"
  button: "3px"
  round: "9999px"
spacing:
  gutter-phone: "1rem"
  gutter: "3.6vw"
  section-y: "clamp(2.5rem, 4vw, 4rem)"
  heading-gap: "clamp(1.25rem, 1.8vw, 2rem)"
  grid-gap: "0.75rem"
  card-pad: "1.25rem"
  header-height: "5.75rem"
  title-band: "clamp(19rem, 23vw, 24rem)"
components:
  button-primary:
    backgroundColor: "{colors.season-amber}"
    textColor: "{colors.season-amber-ink}"
    rounded: "{rounded.button}"
    padding: "0 1.4rem"
    height: "2.95rem"
  button-primary-hover:
    backgroundColor: "{colors.season-amber-hover}"
    textColor: "{colors.season-amber-ink}"
  button-outline:
    textColor: "{colors.season-ink}"
    rounded: "{rounded.button}"
    padding: "0 1rem"
    height: "2.75rem"
  link-arrow:
    textColor: "{colors.season-ink}"
    typography: "{typography.body}"
    height: "2.75rem"
  segmented-switch:
    textColor: "{colors.season-ink}"
    rounded: "{rounded.button}"
    height: "2.75rem"
  leader-card:
    backgroundColor: "{colors.season-card}"
    textColor: "{colors.season-ink}"
    rounded: "{rounded.none}"
    padding: "1.25rem 1.5rem 1rem"
  card:
    backgroundColor: "{colors.season-card}"
    textColor: "{colors.season-ink}"
    rounded: "{rounded.none}"
    padding: "{spacing.card-pad}"
  card-hover:
    backgroundColor: "{colors.season-card-hover}"
  still-tile:
    backgroundColor: "{colors.season-night}"
    textColor: "{colors.season-ink}"
    rounded: "{rounded.none}"
    padding: "{spacing.card-pad}"
  marble-plaque:
    backgroundColor: "{colors.season-card}"
    textColor: "{colors.season-ink}"
    rounded: "{rounded.none}"
    padding: "1.25rem"
  nav-link:
    textColor: "{colors.season-white}"
    typography: "{typography.body}"
    padding: "0.5rem 0"
---

# Design System: National Poker League

## Overview

**Creative North Star: "The Season, in a film grade"**

The league is told as a feature film's running record. A cinematic still opens every page and dissolves into it, the title set over the light; the record follows as calm rows, title cards and plaques. The whole picture is colour-graded teal-and-amber: deep petrol-teal grounds and cards, warm off-white text, and a single amber that behaves like the lamp light in the photographs.

Density is moderate and calm. Surfaces are square, flat teal cards with a white hairline at 8%, separated by tone rather than shadow; tables are open rows on hairlines, not boxed grids. Photographs carry atmosphere. Every photo spot is replaceable in admin (`/admin/images`, `src/lib/siteImages.ts`); until a real photo is uploaded each shows a generated stand-in (no real venues, no faces). Photos always fade into the night ground instead of ending in a hard edge. A faint film grain sits over everything so the dark never reads as flat digital black.

Honours get their own materials: badges are struck **seals** (ring text, a short name or number in the middle, a metal per achievement level), and the Hall of Fame sets champions on **marble plaques**. These are the only places the system becomes ornamental, and they stay dark and quiet.

The world rejects casino glitz (neon, felt, chips, card suits, glow), betting-site density and promo energy, and corporate blandness, as PRODUCT.md records. Money is never the hook; play, titles and standings are. Brand navy and gold are no longer binding (owner's decision, 2026-10-03); the NPL Events and league logos remain, and series logos keep their own colours as badges.

**Key Characteristics:**
- Petrol-teal night ground, one teal card tone softly top-lit; depth by tone and photograph, never by shadow.
- One amber light: the primary action, the score figures, the lead, the current item, the focus ring.
- Every page opens with a full-width photo title band that dissolves into the page.
- Logos (league and series) as small badges, not banners.
- Figtree throughout, one family for everything including numbers; tabular figures for every number.
- Square cards with 8% white hairlines; 3px corners on buttons, fields and switches only.
- Context sits in a muted line under a heading, never in a label above it; section headings carry a fine rule to the right.
- Honours as struck seals and marble plaques.

## Colors

A teal-and-amber film grade: cool petrol grounds, warm off-white text, one amber light.

### Primary
- **Lamp Amber** (season-amber): the one accent. The primary action, points of the top three and of leaders, the lead segment of the LeadBar, the climb figures, the 2px active-nav and active-tab underline, the outline of the current choice in a switch, the outline of the "Coming up" and Main Event strips, winners' names in result lists, the focus ring and text selection (at 45%). Text on an amber fill is **Amber Ink** (season-amber-ink); hover lifts the fill to **Bright Amber** (season-amber-hover).

### Neutral
- **Petrol Night** (season-night): the page ground, the target of every photo fade, and the sticky header (at 90% with backdrop blur) on pages without a photo band.
- **Deep Petrol** (season-footer): the footer and the admin toolbar, one step below the page ground.
- **Teal Card** (season-card): cards, panels and the top of most card gradients.
- **Lit Teal** (season-card-lit): the top of a card lit from above (to Teal Card at about 55 to 60%).
- **Deep Teal** (season-card-deep): the bottom of the quieter card gradient (Teal Card to Deep Teal) used for guide cards, titles and admin cards.
- **Teal Card Hover** (season-card-hover): hover state of linked rows and cards.
- **Scrollbar Teal** (season-scrollbar): the scrollbar thumb on the night track.
- **Warm Ink** (season-ink): headings, names, figures and links; at 85 to 90% for ledes and body over photos, 75 to 80% for secondary lines.
- **Warm White** (season-white): Tailwind's white, overridden site-wide; nav and footer links at 85%, full on hover and active. Hairlines are white at 8% (card edges), 12% (table heads, section rules) and 7% (row dividers, header and footer rules).
- **Sea Mist** (season-muted): meta lines, dates, table headings, the title-band subtitle, unreached levels. The lowest text tone on teal.

### Signal
- **Up** (season-up) and **Down** (season-down): places moved since the last update (always with a drawn arrow and the count, never colour alone), consent ticks, success and error notices.

### Named Rules
**The One Light Rule.** Amber is the only accent, and it marks either the action to take, the current choice, or the score that matters (points, the lead, a winner). Headings, rules, borders and decoration are never amber.

**The Badge Rule.** League and series identity lives in their own logos, shown small (about 1.125 to 1.375rem tall). Leagues are never told apart by tinted text, borders or fills; the only exception is the season ribbon, where each series lane uses its logo's colour.

## Typography

**Display Font:** Figtree (with ui-sans-serif, system-ui, sans-serif), loaded via next/font as `--font-figtree`, exposed as `font-season`, and mapped to Tailwind's sans, display and mono so the admin area and every leftover component use it too.
**Body Font:** Figtree.

**Character:** One geometric-humanist sans carries everything; hierarchy comes from size and weight steps (700 display and figures, 600 headings and names, 500 lede and links, 400 body), not from a second face. Numbers use Figtree's tabular figures, never a monospace.

**Scale:** on screens of 64rem and wider the root size is 93.75%, so every rem-based size and space tightens together; phones keep the full size. Sizes below are before that adjustment.

### Hierarchy
- **Display** (700, clamp(2.5rem, 4.3vw, 5.5rem), 1.02, -0.012em): the home hero headline and the "This week" band title.
- **Page title** (700, clamp(2.5rem, 4.4vw, 4.375rem), 1.02, -0.012em): the title in every photo title band ("Hall of Fame", "The 2026 season", a player's name).
- **Headline** (600, clamp(1.875rem, 2.67vw, 2.75rem)): home section headings.
- **Section** (600, clamp(1.5rem, 2vw, 1.875rem)): section headings on inner pages, usually a Ruled Heading.
- **Figure** (700, clamp(2.75rem, 4.4vw, 4.75rem), tabular): climb figures and head-to-head scores.
- **Leader** (600, clamp(1.875rem, 12cqi, 3.25rem)): the leader's name in a league card, sized to its container.
- **Title** (600, clamp(1.75rem, 2.4vw, 2.5rem)): festival tiles over photographs.
- **Lede** (500, clamp(1.0625rem, 1.45vw, 1.375rem), 1.5): the line under a page title, in Sea Mist (in Warm Ink at 90% on the home hero).
- **Body** (400, 1.0625rem): names in rows, excerpts.
- **Meta** (400, 0.9375rem): secondary lines (date, venue, series); table heads at 0.875rem in Sea Mist, sentence case.
- **Label** (700, 0.8125rem, 0.18em, uppercase): footer column headings only.

### Named Rules
**The Line-Under Rule.** Context (date, source, count) goes in a muted line directly under a heading. Nothing small and tracked sits above a heading, in the public site or in admin.

**The Tabular Figures Rule.** Every number (points, gaps, positions, climbs, dates in lists) is set with tabular figures; points always to two decimals.

## Layout

Full-bleed and gutter-based rather than a centred container: content runs edge to edge inside side gutters of 1rem on phones and 3.6vw from 640px. The header is 5.75rem tall; it lies transparently over any page that opens with a photo band, and is a sticky night bar elsewhere (admin adds a 3rem toolbar under it).

**Title band:** every inner page opens with a full-width photo band, clamp(19rem, 23vw, 24rem) tall, title lower left with clamp(2rem, 3vw, 3rem) below it. The photo spans the whole width; it darkens gently on the left behind the title, at the top behind the nav, and fades to Petrol Night at the bottom. A photo can be zoomed (scale and origin) to bring its subject forward.

**Rhythm:** sections are clamp(2.5rem, 4vw, 4rem) apart; a heading sits about 1.25rem above its content. Grids use a 0.75rem gap. Two-column pages (standings beside champions, schedule beside a leaderboard) split about 2:1 or 7:5 from 1024px and stack on phones.

**Left-column labels:** where the reference calls for it (the Hall of Fame wall), years and section labels sit in an 11rem column to the left of their content.

## Elevation & Depth

Flat. Depth comes from tonal layering (Deep Petrol, Petrol Night, Teal Card, Lit Teal) and from photographs. Every photograph is softened by gradients to Petrol Night. A fixed film-grain layer (fractal noise at 3.5% opacity) sits over the whole page.

### Named Rules
**The Dissolve Rule.** A photograph never ends in a hard edge against the page ground; it fades into Petrol Night.

**The No-Shadow Rule.** Cards, buttons and tiles carry no box-shadow and no glow. Separation is by tone and hairline; plaques use inset hairlines, not drop shadows.

## Shapes

Square by default. Cards, tiles, rows, plaques and panels have no radius and a 1px white hairline at 8%. Buttons, fields, switches and small tags have a 3px corner. Only genuinely round things are round: seals, the LeadBar track, progress bars, the 18+ mark. Icons are Lucide line icons at 15 to 20px in one stroke; text glyphs (✓, ✕, ▲) are never used as icons.

## Components

### Buttons and controls
- **Primary:** Lamp Amber fill, Amber Ink text, 600, 2.95rem (2.75rem in tight spots) tall, trailing arrow where it moves you on. One per view.
- **Outline:** transparent with a 1px white-at-14% border, Warm Ink text, 2.75rem tall; hover raises the border to 30% (Share, Compare).
- **Arrow link:** no fill, Warm Ink at 500 with a trailing arrow that nudges 2px on hover; minimum 2.75rem tap height.
- **Segmented switch:** a row of 2.75rem options inside a 1px white-at-12% frame; the current option has an amber inset outline and a 12% amber wash (season, league, sort, "This season / All-time").
- **Tabs:** text links on a hairline with a 3px amber underline on the current tab.
- **Fields:** 3rem tall, Petrol Night at 60 to 70%, 1px white-at-14% border, amber caret; focus shows the border at 60% amber plus the global ring. Labels sit above in 0.9375rem Warm Ink at 85%.
- **Focus:** a 2px amber outline at 2px offset everywhere.

### Ruled Heading
A section heading with a 1px white-at-12% rule running to the right edge (`src/components/RuledHeading.tsx`). The heading may wrap; the rule keeps at least 1.5rem.

### Calm Table
Standings and result lists are open rows: a sentence-case Sea Mist head on a 12% rule, rows divided by 7% hairlines, about 3.75rem tall, names large, figures tabular and right-aligned, the top three's rank and points in amber, movement as a drawn arrow plus count, and the titles a player holds as small seals (about 30px, a ×count where won more than once) beside the name. Phones keep rank, name and the one figure the list is ranked by.

### Leader Card (signature)
Who leads one league, as a plain title card on the home page: top-lit gradient, the league logo as a small badge, the leader's name very large, points in amber, the LeadBar, the gap and 2nd and 3rd, then a "Full leaderboard" link. Anonymised players render as plain text, never as links.

### LeadBar (signature)
A 0.5rem round track at white 10%: the muted segment is how far 2nd place has reached, the amber segment the lead still between them.

### Title Band and Hero Title Card (signature)
The home hero is one cinematic still with the display headline, a lede, the amber action and an arrow link; it rises in once (0.5s, 8px). Inner pages use the shared Title Band (`TitleBand` in `src/components/tournaments/ComingUp.tsx`).

### Struck Seal (signature)
Every badge is drawn as a seal (`Seal` in `src/components/badges/BadgeMedal.tsx`, text from `src/lib/badgeSeal.ts`): a dark radial face, a thin rim, text curving round the ring, the short name or number struck in the middle. Titles wear an amber rim; achievement levels wear their metal (bronze, silver, gold, emerald, diamond, purple for Legendary) with level pips. Unreached levels are faded with a dotted rim. Uploaded artwork replaces the seal. Records on the Hall of Fame are struck the same way, in a metal without pips.

### Marble Plaque (signature)
Hall of Fame champions and records sit on plaques: a dark teal marble texture (replaceable in admin) under a soft light from the top and a darker bottom edge, a fine amber frame and an inset night line.

### Season Calendar
The Tournaments hub's year ribbon: twelve month columns, one lane per series in its logo colour, festivals as bars and single events as ticks; labels stay pinned while the ribbon scrolls sideways on phones. Each month then opens as a chapter with its name set large, festival strips and one-line event rows.

### Festival Strip and Coming Up
A festival strip is a wide row: a still (the series photo if set, else a room photo), the series logo, name, dates and venue, the Main Event winner in amber, and the number of events. "Coming up" leads with the next date as a large amber-outlined strip ("Starts in N days"), the next few as slim rows.

### Auth and Error Screens
Sign-in, sign-up and reset use one card on a dim room still with labelled fields and the amber action (`src/components/auth/AuthShell.tsx`). 404, 403 and errors use a large amber code, a plain explanation and two ways forward (`src/components/ErrorScreen.tsx`).

### Navigation
Right-aligned text links in Warm White at 85%; the current page has a 2px amber bar. Below 1024px a menu toggle opens a full-width Petrol Night panel. The footer carries the logo, four link columns, and the 18+ mark with the GambleAware link on every page.

### Admin
Admin uses daisyUI, themed to this palette in `globals.css` (base Teal Card and Petrol Night, primary Lamp Amber, 3px corners), so every admin screen follows the system. Pages open with a page title and a muted line, detail pages with a back link; the weekly import gets an amber-outlined strip on the dashboard.

## Do's and Don'ts

### Do:
- **Do** keep amber to the primary action, the current choice, the score figures and winners, the active-nav bar and the focus ring.
- **Do** fade every photograph into Petrol Night; no hard image edges.
- **Do** open inner pages with the shared title band, title lower left, subtitle in Sea Mist.
- **Do** show league and series logos small, as badges.
- **Do** put dates, sources and counts in a muted line under the heading (e.g. "Results up to 20 Sept 2026").
- **Do** set every number with tabular figures, points to two decimals.
- **Do** keep cards square on Teal Card with a 1px white hairline at 8%.
- **Do** draw badges as struck seals and keep honours on dark seals and marble plaques.
- **Do** render anonymised players as plain unlinked text and leave them out of searches and climbers.
- **Do** drop prize-money suffixes ("£50,000 GTD") from event names in display.
- **Do** make every photo spot replaceable (site photos, series, festivals, venues), with a generated stand-in as its default.
- **Do** respect reduced motion; one authored entrance per page at most.

### Don't:
- **Don't** place kickers, eyebrows or small tracked labels above headings.
- **Don't** use text quieter than Sea Mist on teal.
- **Don't** add box-shadows, glows or rounded corners to cards, tiles and plaques.
- **Don't** use amber for headings, rules, borders or decoration, or put a second amber button in the same view.
- **Don't** colour text, borders or fills with league colours.
- **Don't** use text glyphs as icons, or a monospace for numbers.
- **Don't** present a generated still as a real venue, or show identifiable people in it.
- **Don't** introduce casino glitz (neon, felt, chips, card suits), betting-site density or promo banners.
- **Don't** make money the hook: no prize amounts in titles or as headline figures, and no unconfirmed prize figures anywhere.
- **Don't** rank or frame badges by rarity; the badges page explains what to earn, the Hall of Fame and profiles show who earned it.
