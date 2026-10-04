import { config } from "@/lib/config";
import LogoMark from "./LogoMark";
import SiteBarAccount from "./SiteBarAccount";

// A bar across the top of every page linking back to the website this server
// belongs to (SITE_URL, SITE_LINKS), e.g. the hosted service's landing page.
// Only shown when SITE_URL is set. On phones the links fold into a menu; the
// account corner stays.
export default function SiteBar() {
  const site = config.site;
  if (!site) return null;
  const links = site.links.map((l) => (
    <a key={`${l.label} ${l.href}`} href={l.href}>
      {l.label}
    </a>
  ));
  return (
    <header className="sitebar">
      <div className="sitebar-inner">
        <a href={site.url} className="sitebar-logo" aria-label="Bookplate, home">
          <LogoMark />
        </a>
        {links.length > 0 && (
          <>
            <nav className="sitebar-links" aria-label="Site">
              {links}
            </nav>
            <details className="sitebar-menu">
              <summary>Menu</summary>
              <nav className="sitebar-menu-links" aria-label="Site">
                {links}
              </nav>
            </details>
          </>
        )}
        <SiteBarAccount signupOpen={config.registration === "open"} />
      </div>
    </header>
  );
}
