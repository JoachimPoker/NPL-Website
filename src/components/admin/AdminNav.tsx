"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { label: "Dashboard", href: "/admin" },
  { label: "Import", href: "/admin/import" },
  { label: "Seasons", href: "/admin/seasons" },
  { label: "Leagues", href: "/admin/leagues" },
  { label: "Series", href: "/admin/series" },
  { label: "Festivals", href: "/admin/festivals" },
  { label: "Events", href: "/admin/events" },
  { label: "Players", href: "/admin/players" },
  { label: "Schedule", href: "/admin/schedule" },
  { label: "Badges", href: "/admin/badges" },
  { label: "News", href: "/admin/news" },
  { label: "Photos", href: "/admin/images" },
  { label: "Messages", href: "/admin/messages" },
  { label: "Users", href: "/admin/users" },
];

/** Admin section links, styled like the site's main navigation. */
export default function AdminNav() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  return (
    <nav aria-label="Admin" className="no-scrollbar -mx-1 flex min-w-0 items-center gap-0.5 overflow-x-auto">
      {LINKS.map((link) => {
        const active = isActive(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`relative flex h-12 shrink-0 items-center px-2.5 text-[0.9375rem] font-medium transition-colors ${
              active ? "text-season-ink after:absolute after:inset-x-2.5 after:bottom-0 after:h-[2px] after:bg-season-amber" : "text-season-ink/65 hover:text-season-ink"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
