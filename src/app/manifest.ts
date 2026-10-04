import type { MetadataRoute } from "next";
import { SITE_NAME } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: "NPL",
    description: "Standings, results and player stats for the National Poker League.",
    start_url: "/",
    display: "standalone",
    background_color: "#06191c",
    theme_color: "#06191c",
    icons: [
      { src: "/icon.png", type: "image/png", sizes: "512x512" },
      { src: "/apple-icon.png", type: "image/png", sizes: "180x180" },
    ],
  };
}
