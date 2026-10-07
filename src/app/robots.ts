import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// AI training and scraping crawlers: nothing to gain for the league. Also denied by the
// Vercel Firewall (Bot Management → AI Bots); this asks the polite ones to stop asking.
const AI_CRAWLERS = [
  "GPTBot", "ChatGPT-User", "OAI-SearchBot", "ClaudeBot", "Claude-User", "Claude-SearchBot", "anthropic-ai",
  "CCBot", "Google-Extended", "Applebot-Extended", "Bytespider", "meta-externalagent", "PerplexityBot",
  "Amazonbot", "cohere-ai", "Diffbot", "ImagesiftBot", "Omgilibot", "Timpibot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin", "/api/", "/login", "/logout", "/auth/", "/403",
          // Every sort, tab, filter and page of a profile is the same player: crawl /players/<id> only
          // (each profile also names it as canonical).
          "/players/*?",
          "/*?*sort=",
          "/*?*dir=",
          "/*?*_rsc=",
          // Any two players can be compared: endless pages with nothing new on them.
          "/compare",
        ],
      },
      { userAgent: AI_CRAWLERS, disallow: "/" },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
