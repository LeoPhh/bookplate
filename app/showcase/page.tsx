import { redirect } from "next/navigation";
import { connection } from "next/server";
import ShowcaseLive from "@/components/ShowcaseLive";
import ShowcasePromo from "@/components/ShowcasePromo";
import ShowcaseView, { plural } from "@/components/ShowcaseView";
import { getSession } from "@/lib/auth";
import { config } from "@/lib/config";
import { todayIso } from "@/lib/progress";
import { getShowcase, previewShowcase, showcaseYears } from "@/lib/showcase";
import { sampleShowcase } from "@/lib/showcaseSample";

// The Showcase tab. With a showcase on: its link, ways to change it or turn
// it off, and what visitors see. Without: the pitch, with a demo of the
// reader's own best year (or a sample shelf when they've too few books).

const DEMO_MIN_BOOKS = 4;

export default async function ShowcasePage() {
  await connection();
  const session = await getSession();
  if (!session) redirect("/login");
  const userId = session.user.id;
  const today = todayIso();
  const thisYear = Number(today.slice(0, 4));
  const live = await getShowcase(userId);

  if (live) {
    const view = await previewShowcase(userId, live);
    const parts = [
      view.read.length > 0 && `${plural(view.read.length, "book")} you finished in ${live.year}`,
      view.reading.length > 0 && `${plural(view.reading.length, "book")} you’re reading`,
    ].filter(Boolean);
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
          summary={parts.length ? parts.join(" and ") : `your ${live.year} shelf, still empty for now`}
        />
        <section className="live-preview">
          <p className="live-preview-label">What visitors see</p>
          <div className="showcase showcase--framed">
            <ShowcaseView name={live.name} view={view} today={today} />
          </div>
        </section>
        <footer className="colophon">— ex libris —</footer>
      </main>
    );
  }

  const years = await showcaseYears(userId);
  const best = years
    .filter((y) => y.books >= DEMO_MIN_BOOKS)
    .sort((a, b) => b.books - a.books || b.year - a.year)[0];
  const view = best
    ? await previewShowcase(userId, { year: best.year, include: best.year === thisYear ? "both" : "read" })
    : sampleShowcase(today);

  return (
    <main className="page">
      <ShowcasePromo
        name={session.user.name.trim().split(/\s+/)[0] ?? ""}
        view={view}
        sample={!best}
        years={years.map((y) => y.year)}
        host={new URL(config.publicUrl).host}
      />
      <footer className="colophon">— ex libris —</footer>
    </main>
  );
}
