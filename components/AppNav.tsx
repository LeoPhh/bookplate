"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Library" },
  { href: "/vocabulary", label: "Vocabulary" },
  { href: "/statistics", label: "Statistics" },
];

// The app's sections, in the bar along the top (a tab bar at the bottom of
// the screen on phones). A book's notes page counts as the library.
export default function AppNav() {
  const path = usePathname();
  const current = (href: string) => (href === "/" ? path === "/" || path.startsWith("/books/") : path.startsWith(href));
  return (
    <nav className="appbar-nav" aria-label="Sections">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={current(l.href) ? "appbar-link appbar-link--active" : "appbar-link"}
          aria-current={current(l.href) ? "page" : undefined}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
