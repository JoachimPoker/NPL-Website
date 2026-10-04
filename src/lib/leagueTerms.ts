// src/lib/leagueTerms.ts
// The 2026 league terms (NPL, High Roller and Low Roller), summarised from the promoter's published T&Cs (public/docs). The PDFs are the
// authority; update this file alongside them when a new season's terms are issued.

export const TERMS_YEAR = 2026;

export const TERMS_DOCS = [
  { label: "National Poker League 2026 T&Cs", href: "/docs/npl-2026-terms.pdf" },
  { label: "High Roller League 2026 T&Cs", href: "/docs/hrl-2026-terms.pdf" },
  { label: "Low Roller League 2026 T&Cs", href: "/docs/lrl-2026-terms.pdf" },
];

/** How points are earned (NPL T&Cs 15–18, 47). */
export const SCORING = [
  "Points are only awarded to players who cash in an event.",
  "How many points a cash is worth depends on the buy-in, the size of the field and your finishing position.",
  "Your 20 highest-scoring results count, plus 2 points for every cash after your 20th.",
  "You must attend and play the event in person to earn points.",
];

export type LeagueTerms = {
  slug: "npl" | "hrl" | "lrl";
  dates: string | null;
  standings: string | null;
  counts: string[];
  notes: string[];
};

export const LEAGUE_TERMS: LeagueTerms[] = [
  {
    slug: "npl",
    dates: "1 January to 15 December 2026",
    standings: "Final standings announced by 22 December 2026",
    counts: ["GUKPT festival events", "G300", "G200", "UK Open", "Goliath", "888 UKPL", "888poker Live", "GUKPT Online Closer events", "Special events added during the year"],
    notes: ["Restricted events (such as Women's and Seniors events) don't award league points."],
  },
  {
    slug: "hrl",
    dates: "1 January to 31 December 2026",
    standings: "Final standings announced by 4 January 2027",
    counts: ["GUKPT High Roller", "888poker High Roller", "UKPL High Roller", "Any third-party High Roller event hosted in a Grosvenor casino", "Special events added during the year"],
    notes: ["Points also count towards the National Poker League."],
  },
  {
    slug: "lrl",
    dates: "1 January to 13 December 2026",
    standings: "Final standings announced by 20 December 2026",
    counts: [
      "Live NPL events with a buy-in of £300 or less",
      "Goliath Main Event",
      "GUKPT Mini Main and Opener",
      "GUKPT and Goliath side events of £300 or less",
      "G300 and G200",
      "888 UKPL Opening Voyage, and 888 events of £300 or less",
    ],
    notes: ["Goliath side events with “Redtooth” in the name don't count.", "Points also count towards the National Poker League."],
  },
];

/** What happens after the season (NPL 20–31, 41–45; LRL 23–24). No prize amounts: those in the terms are examples, not confirmed. */
export const SEASON_END = [
  {
    title: "The invitational",
    body: "The top 18 in the National Poker League and the top 3 in both the High Roller and Low Roller leagues meet in a 24-player invitational at GUKPT Leg 1 at the Vic in January 2027.",
  },
  {
    title: "The league play-off",
    body: "The highest 75 finishers who haven't won a package play off for further packages, also at Leg 1. You must attend to take part.",
  },
  {
    title: "Last Chance Online Play-off",
    body: "The top 200 who haven't won a package are invited to an online play-off after the live play-off. You register yourself once it appears in the online lobby.",
  },
  {
    title: "One invitational seat per player",
    body: "If a player qualifies through more than one league, the National Poker League seat comes first, then the High Roller League; the seat they don't take passes to the next player in that league.",
  },
  {
    title: "Ties",
    body: "A tie at the top is decided by the most top-three finishes, then the most final tables.",
  },
];

export const PROMOTER = "Grosvenor Casinos Limited";
