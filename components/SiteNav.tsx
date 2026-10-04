"use client";

import Link from "next/link";
import { useSiteBar } from "./SiteBarContext";
import UserMenu from "./UserMenu";

// Section switcher shown in the masthead of every page, plus the account
// menu in the masthead's top-right corner — unless the site bar is showing,
// which holds the account menu instead.
export default function SiteNav({ active }: { active?: "library" | "vocabulary" | "statistics" }) {
  const siteBar = useSiteBar();
  return (
    <>
      <nav className="site-nav" aria-label="Sections">
        <Link href="/" className={active === "library" ? "site-nav-link site-nav-link--active" : "site-nav-link"}>
          Library
        </Link>
        <span className="site-nav-sep" aria-hidden>
          ·
        </span>
        <Link
          href="/vocabulary"
          className={active === "vocabulary" ? "site-nav-link site-nav-link--active" : "site-nav-link"}
        >
          Vocabulary
        </Link>
        <span className="site-nav-sep" aria-hidden>
          ·
        </span>
        <Link
          href="/statistics"
          className={active === "statistics" ? "site-nav-link site-nav-link--active" : "site-nav-link"}
        >
          Statistics
        </Link>
      </nav>
      {!siteBar && <UserMenu />}
    </>
  );
}
