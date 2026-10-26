"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Library" },
  { href: "/vocabulary", label: "Vocabulary" },
  { href: "/statistics", label: "Statistics" },
  { href: "/showcase", label: "Showcase" },
];

// With social features (SOCIAL=true), Profile takes Showcase's place, and
// Friends follows it.
const SOCIAL_LINKS = [
  ...LINKS.map((l) => (l.href === "/showcase" ? { href: "/profile", label: "Profile" } : l)),
  { href: "/friends", label: "Friends" },
];

// The app's sections, in the bar along the top (a tab bar at the bottom of
// the screen on phones). A book's notes page counts as the library; any
// profile page counts as Profile. `social` is null without social features;
// its unread count badges Friends, except on Friends itself, which reads them.
export default function AppNav({ social }: { social: { unread: number } | null }) {
  const path = usePathname();
  const current = (href: string) =>
    href === "/" ? path === "/" || path.startsWith("/books/")
    : href === "/profile" ? path.startsWith("/profile") || path.startsWith("/u/")
    : path.startsWith(href);
  return (
    <nav className="appbar-nav" aria-label="Sections">
      {(social ? SOCIAL_LINKS : LINKS).map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={current(l.href) ? "appbar-link appbar-link--active" : "appbar-link"}
          aria-current={current(l.href) ? "page" : undefined}
        >
          {l.label}
          {l.href === "/friends" && social && social.unread > 0 && !current("/friends") && (
            <span className="appbar-badge" aria-label={`${social.unread} new`}>
              {social.unread > 9 ? "9+" : social.unread}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
