import Link from "next/link";

// Small section switcher shown in the masthead of every page.
export default function SiteNav({ active }: { active: "library" | "vocabulary" | "statistics" | "settings" }) {
  return (
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
      <span className="site-nav-sep" aria-hidden>
        ·
      </span>
      <Link
        href="/settings"
        className={active === "settings" ? "site-nav-link site-nav-link--active" : "site-nav-link"}
      >
        Settings
      </Link>
    </nav>
  );
}
