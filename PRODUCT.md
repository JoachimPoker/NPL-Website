# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Regular league players (primary).** UK casino tournament players in the National Poker League. They come to check their own position, points, recent cashes and whether they are inside the prize places, often on a phone at or just after a tournament or when the weekly results land.
- **Casual and prospective players.** People discovering the league: what it is, which festivals and series are coming up, where they run (venues), and what the standings look like, before deciding to play.

Admins and staff use the `/admin` area to import reports and curate content. It is a secondary internal audience, not the design target for public surfaces.

## Product Purpose

The public record of the National Poker League and High Roller League: season and all-time leaderboards, tournament and festival results, player profiles and careers, badges and achievements, Hall of Fame, venues, schedule and news. Success means players trust the standings as accurate and current, return after every weekly update, and new players understand the league well enough to want to take part.

## Positioning

An independent site, built with the league's endorsement and fed by the league's own weekly points report. That makes it the most complete public record of NPL results: every cash, across every series and season, connected to a player profile. It is not an operator marketing site and not a general poker news outlet.

## Operating Context

- Results arrive as a weekly "RawPlayerData" Excel report (sheet `TotalPoints`) that an admin imports through `/admin/import`. Preview, penalties, soft-deletes and statistics run in Supabase. Standings are only as fresh as the latest import.
- Tournaments run at UK casino venues and are grouped into series (GUKPT, Goliath, UK Open, Behemoth, …) and festivals. Some festivals are auto-detected and some are made by hand.
- Seasons have date ranges, a scoring cap (`cap_x`) and configurable prize places.
- Badges (titles won, Main Event and league podiums) and achievements (14 ladders, six levels from Bronze to Legendary) are awarded automatically after each import.

## Capabilities and Constraints

- Stack: Next.js (App Router), React 19, Tailwind 4 with daisyUI, Supabase (Postgres, auth and RLS; admin rights via `app_metadata`), deployed on Vercel. Locale is en-GB.
- Terminology in use: "Leaderboards" (renamed from Standings), "Tournaments" for events, series, festivals, Main Event, High Roller League, Hall of Fame, badges, achievements, prize places.
- **Player privacy / GDPR is a hard constraint.** Players flagged as anonymised (`is_anonymized` / report `gdpr` flag) must never be identifiable on any surface, share image or URL. Personal fields in the report (date of birth, card and membership numbers) are never shown publicly.
- **Gambling compliance is a hard constraint.** 18+ and safer-gambling messaging (GambleAware.org) stays on every public page. Design and copy must not glamorise winning, prize money or gambling as a route to money.
- **Brand marks:** the NPL EVENTS logo and the three league logos (`public/brand/*.svg`) are kept. **Colours are no longer bound to the brand navy #1F1A5A / gold #D59516**: on 2026-10-03 the owner said to ignore the brand guidelines for colour and asked for a palette chosen on design grounds. League logos are shown small, as badges, not as full-width bars.

## Brand Commitments

- Name: "National Poker League" (NPL), with the "NPL Events" mark at `public/brand/npl-events.png`. The High Roller League is a named sub-league.
- The endorsed relationship is reflected in the copy: "unofficial" wording was deliberately removed. The site still must not claim to be operated by the league or a casino.
- Voice: UK English, plain and factual, record-keeping rather than hype.
- Must never feel like: casino glitz (neon, chips, slot-machine glow, felt, card suits everywhere), a betting site (odds-board density, promo banners, "bet now" energy), or bland corporate. (Confirmed by the owner, 2026-10-03.)

## Evidence on Hand

- Real results data in Supabase, imported from the league's weekly reports. Standings, player histories, badges and Hall of Fame entries are genuine.
- Brand asset: `public/brand/npl-events.png`. Each league has a logo (`league_brands` migration).
- No testimonials, player quotes, partner logos, prize-pool totals or attendance figures have been supplied. Do not invent them.

## Product Principles

1. **The record is the product.** Accuracy, completeness and freshness come before decoration. Always show which season and which report the numbers come from.
2. **"Where do I stand?" in seconds.** A regular player should find their position, points and gap to the prize line with as little effort as possible, especially on a phone.
3. **Celebrate play, not money.** Recognise titles, consistency and achievements; never make winnings the hook.
4. **Privacy by default.** If there is any doubt about whether a player can be shown, they are not shown.
5. **Endorsed, not official.** Speak with the league's authority on results, but never present the site as the operator.

## Accessibility & Inclusion

No product-specific standard has been mandated. Existing commitments: a skip link, a dark colour scheme and keyboard-reachable navigation. Treat WCAG 2.2 AA as the working floor.
