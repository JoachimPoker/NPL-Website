// src/app/layout.tsx
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { Figtree } from "next/font/google";
import Providers from "./providers";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

// "The Season" redesign face (DESIGN.md is rewritten from the finished build).
const season = Figtree({ subsets: ["latin"], variable: "--font-figtree", weight: ["400", "500", "600", "700"] });

const DESCRIPTION =
  "Season standings, tournament results and player stats for the National Poker League.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: { title: SITE_NAME, description: DESCRIPTION, siteName: SITE_NAME, type: "website", locale: "en_GB" },
  twitter: { card: "summary_large_image", title: SITE_NAME, description: DESCRIPTION },
};

export const viewport: Viewport = { themeColor: "#06191c", colorScheme: "dark" };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="npl" className={season.variable}>
      <body className="font-sans min-h-screen bg-base-200 text-base-content antialiased flex flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-content"
        >
          Skip to content
        </a>
        <Providers>
          <SiteHeader />
          <main id="main" className="flex-1 flex flex-col">
            {children}
          </main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
