"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminNav() {
  const pathname = usePathname();

  const links = [
    { label: "Dashboard", href: "/admin" },
    { label: "Seasons", href: "/admin/seasons" },
    { label: "Series", href: "/admin/series" },
    { label: "Events", href: "/admin/events" },
    { label: "Players", href: "/admin/players" },
    { label: "Import", href: "/admin/import" },
  ];

  // Helper to check if link is active
  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  return (
    <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar mask-linear-fade">
      {links.map((link) => {
        const active = isActive(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`
              btn btn-sm text-xs font-bold uppercase tracking-wider transition-all
              ${active 
                ? "btn-primary text-primary-content shadow-glow" 
                : "btn-ghost text-base-content/60 hover:text-white hover:bg-white/5"
              }
            `}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}