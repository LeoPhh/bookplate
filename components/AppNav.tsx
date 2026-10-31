"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const LINKS = [
  { href: "/", label: "Library" },
  { href: "/vocabulary", label: "Vocabulary" },
  { href: "/statistics", label: "Statistics" },
];

// With social features (SOCIAL=true), Profile follows them.
const SOCIAL_LINKS = [...LINKS, { href: "/profile", label: "Profile" }];

// A book's notes page counts as the library; any profile page counts as Profile.
function isCurrent(href: string, path: string) {
  return href === "/" ? path === "/" || path.startsWith("/books/")
    : href === "/profile" ? path.startsWith("/profile") || path.startsWith("/u/") || path.startsWith("/friends")
    : path.startsWith(href);
}

// The app's sections, in the bar along the top. Phones get AppMenu instead.
export default function AppNav({ social }: { social: boolean }) {
  const path = usePathname();
  return (
    <nav className="appbar-nav" aria-label="Sections">
      {(social ? SOCIAL_LINKS : LINKS).map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={isCurrent(l.href, path) ? "appbar-link appbar-link--active" : "appbar-link"}
          aria-current={isCurrent(l.href, path) ? "page" : undefined}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

// The same sections on phones: a burger beside the profile picture.
export function AppMenu({ social }: { social: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="app-menu" ref={ref}>
      <button
        type="button"
        className={open ? "app-menu-button app-menu-button--open" : "app-menu-button"}
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <svg className="app-menu-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 6 H20" />
          <path d="M4 12 H20" />
          <path d="M4 18 H20" />
        </svg>
      </button>
      {open && (
        <nav className="user-menu-panel app-menu-panel" aria-label="Sections">
          {(social ? SOCIAL_LINKS : LINKS).map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={isCurrent(l.href, path) ? "user-menu-item app-menu-item--active" : "user-menu-item"}
              aria-current={isCurrent(l.href, path) ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
