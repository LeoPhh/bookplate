import { redirect } from "next/navigation";
import { connection } from "next/server";
import ShowcaseLive from "@/components/ShowcaseLive";
import ShowcasePromo from "@/components/ShowcasePromo";
import ShowcaseSetup from "@/components/ShowcaseSetup";
import { plural } from "@/components/ShowcaseView";
import { getSession } from "@/lib/auth";
import { config } from "@/lib/config";
import { todayIso } from "@/lib/progress";
import { getShowcase, previewShowcase, showcaseYears } from "@/lib/showcase";
import { sampleShowcase } from "@/lib/showcaseSample";

// The Showcase tab. With a showcase on: its link, and ways to change it or
// turn it off. Without: the pitch, with a demo of the
// reader's own best year (or a sample shelf when they've too few books).
// Either way the year picker is at the foot of the page.

const DEMO_MIN_BOOKS = 10;

// The address in the demo's mock link: this server's, unless it's a local
// one nobody else could open, which would spoil the illusion.
const DEMO_HOST = "app.bookplate.eu";

function demoHost(publicUrl: string): string {
  const { hostname, host } = new URL(publicUrl);
  return /^(localhost|127\.|\[::1\]$|0\.0\.0\.0$)/.test(hostname) || hostname.endsWith(".local") ? DEMO_HOST : host;
}

export default async function ShowcasePage() {
  await connection();
  const session = await getSession();
  if (!session) redirect("/login");
  const userId = session.user.id;
  const today = todayIso();
  const [live, years] = await Promise.all([getShowcase(userId), showcaseYears(userId)]);
  const firstName = session.user.name.trim().split(/\s+/)[0] ?? "";

  const year = live?.year ?? years[0].year;
  const name = live ? (live.name ?? "") : firstName;
  const setup = (title: string) => (
    <section>
      <h2 className="promo-heading">{title}</h2>
      <ShowcaseSetup years={years} live={live} initial={{ year, name }} />
    </section>
  );

  if (live) {
    const view = await previewShowcase(userId, live.year);
    return (
      <main className="page">
        <header className="masthead">
          <p className="masthead-eyebrow">Your Own Personal, Digital Library</p>
          <h1 className="masthead-title">Showcase</h1>
        </header>
        <ShowcaseLive
          id={live.id}
          year={live.year}
          url={`${config.publicUrl}/s/${live.id}`}
          summary={
            view.read.length > 0
              ? `the ${plural(view.read.length, "book")} you finished in ${live.year}`
              : `your ${live.year} shelf, still empty for now`
          }
        />
        <div className="live-setup">{setup("Change the year or name")}</div>
        <footer className="colophon">— ex libris —</footer>
      </main>
    );
  }

  const best = years
    .filter((y) => y.books >= DEMO_MIN_BOOKS)
    .sort((a, b) => b.books - a.books || b.year - a.year)[0];
  const view = best
    ? await previewShowcase(userId, best.year)
    : sampleShowcase(today);

  return (
    <main className="page">
      <ShowcasePromo
        name={firstName}
        view={view}
        sample={!best}
        years={years}
        host={demoHost(config.publicUrl)}
      >
        {setup("Put yours on display")}
      </ShowcasePromo>
      <footer className="colophon">— ex libris —</footer>
    </main>
  );
}
