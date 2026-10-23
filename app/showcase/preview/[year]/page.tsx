import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import ShowcasePreviewBar from "@/components/ShowcasePreviewBar";
import ShowcaseView from "@/components/ShowcaseView";
import { getSession } from "@/lib/auth";
import { todayIso } from "@/lib/progress";
import { getShowcase, parseShowcase, previewShowcase, ShowcaseError } from "@/lib/showcase";

// How a year would look as the reader's showcase, before anyone else sees
// it. Private: it's built from the signed-in reader's own library, and saved
// nowhere.

type Props = {
  params: Promise<{ year: string }>;
  searchParams: Promise<{ include?: string; name?: string }>;
};

export default async function ShowcasePreviewPage({ params, searchParams }: Props) {
  await connection();
  const session = await getSession();
  if (!session) redirect("/login");
  const today = todayIso();
  const { include, name } = await searchParams;
  const year = Number((await params).year);

  let choice;
  try {
    choice = parseShowcase(
      {
        year,
        include: include ?? "both",
        name: name ?? session.user.name.trim().split(/\s+/)[0] ?? "",
      },
      Number(today.slice(0, 4)),
    );
  } catch (e) {
    if (e instanceof ShowcaseError) notFound();
    throw e;
  }
  const [view, live] = await Promise.all([previewShowcase(session.user.id, choice), getShowcase(session.user.id)]);

  return (
    <main className="page showcase">
      <ShowcasePreviewBar year={choice.year} include={choice.include} name={choice.name ?? ""} liveYear={live?.year ?? null} />
      <ShowcaseView name={choice.name} view={view} today={today} />
      <footer className="showcase-footer">
        <span>Made with Bookplate</span>
      </footer>
    </main>
  );
}
