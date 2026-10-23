import { redirect } from "next/navigation";
import { connection } from "next/server";
import ShowcaseSetup from "@/components/ShowcaseSetup";
import { getSession } from "@/lib/auth";
import { getShowcase, showcaseYears } from "@/lib/showcase";
import { INCLUDES, type ShowcaseInclude } from "@/lib/showcaseYear";

// Choosing (or changing) the year a reader's showcase shows. A preview
// sends them back here with their choices in the address, so nothing's lost.

type Props = { searchParams: Promise<{ year?: string; include?: string; name?: string }> };

export default async function ShowcaseSetupPage({ searchParams }: Props) {
  await connection();
  const session = await getSession();
  if (!session) redirect("/login");
  const params = await searchParams;
  const [years, live] = await Promise.all([showcaseYears(session.user.id), getShowcase(session.user.id)]);
  const thisYear = years[0].year;

  const asked = Number(params.year);
  const year = years.some((y) => y.year === asked) ? asked : (live?.year ?? thisYear);
  const include = INCLUDES.includes(params.include as ShowcaseInclude)
    ? (params.include as ShowcaseInclude)
    : (live?.include ?? (year === thisYear ? "both" : "read"));
  const name = params.name ?? (live ? (live.name ?? "") : (session.user.name.trim().split(/\s+/)[0] ?? ""));

  return (
    <main className="page">
      <header className="masthead">
        <p className="masthead-eyebrow">Your Own Personal, Digital Library</p>
        <h1 className="masthead-title">Showcase</h1>
        <p className="masthead-stats">
          {live ? "Change what your showcase shows. The link stays the same." : "Choose a year to put on show."}
        </p>
      </header>
      <ShowcaseSetup years={years} live={live} initial={{ year, include, name }} />
      <footer className="colophon">— ex libris —</footer>
    </main>
  );
}
