// src/app/layout.tsx
import "./globals.css";
import { Inter } from "next/font/google";
import Providers from "./providers";
import SiteHeader from "@/components/SiteHeader";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "National Poker League",
  description: "Leaderboards and stats for the NPL",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Data-theme "dim" gives that professional dark blue-grey look
    <html lang="en" data-theme="dim">
      <body className={`${inter.className} min-h-screen bg-base-100 text-base-content antialiased flex flex-col`}>
        <Providers>
          <SiteHeader />
          {/* Main content expands to fill space, but formatting is handled per-page now */}
          <main className="flex-1 flex flex-col">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}