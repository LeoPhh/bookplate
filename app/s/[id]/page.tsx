import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import ShowcaseView, { plural, showcaseHeading } from "@/components/ShowcaseView";
import { getSession } from "@/lib/auth";
import { config, CONTACT_EMAIL } from "@/lib/config";
import { loadShowcase } from "@/lib/showcase";
import { getProfile } from "@/lib/social/profile";
import { possessive } from "@/lib/showcaseYear";
import { todayIso } from "@/lib/progress";

// A showcase: one reader's year of reading, public to anyone with the link
// (lib/showcase.ts). Live: it reads the library each time it's opened.

const load = cache(loadShowcase);
// Where the invitation at the foot leads: the project's own site.
const LANDING_URL = "https://bookplate.eu";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await load((await params).id);
  if (!found) return { title: "Bookplate", robots: { index: false, follow: false } };
  const { showcase, view } = found;
  const title = showcaseHeading(showcase.name, showcase.year);
  const description = view.read.length
    ? `${plural(view.read.length, "book")} read in ${showcase.year}, kept on Bookplate.`
    : `What’s being read in ${showcase.year}, kept on Bookplate.`;
  return {
    title: `${title} · Bookplate`,
    description,
    // Only people given the link should find it.
    robots: { index: false, follow: false },
    metadataBase: new URL(config.publicUrl),
    openGraph: { title, description, type: "website", siteName: "Bookplate" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ShowcasePage({ params }: Props) {
  const { id } = await params;
  const found = await load(id);
  if (!found) notFound();
  const { showcase, userId, view } = found;
  // Where profiles have taken over, a showcase link leads to its reader's
  // profile once its reading is public; until then the showcase stays as it was.
  if (config.social) {
    const profile = await getProfile(userId);
    if (profile?.visibility === "public") redirect(`/u/${profile.handle}`);
  }
  const session = await getSession().catch(() => null);
  const owner = session?.user.id === userId;

  const reportHref = CONTACT_EMAIL
    ? `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Report a showcase")}&body=${encodeURIComponent(
        `${config.publicUrl}/s/${id}\n\nWhat's wrong with it:\n`,
      )}`
    : null;

  return (
    <main className="page showcase">
      {owner && (
        <p className="showcase-note">
          This is your showcase. Change it or turn it off on the <a href="/showcase">Showcase</a> tab.
        </p>
      )}

      <ShowcaseView name={showcase.name} view={view} today={todayIso()} />

      {!session && (
        <section className="showcase-cta">
          <p className="showcase-cta-title">
            {showcase.name ? `Keep a library like ${possessive(showcase.name)}.` : "Keep a library like this one."}
          </p>
          <p className="showcase-cta-text">
            Bookplate is a free home for your books, your notes on them and the words you learn along the way.
          </p>
          <a className="btn btn--accent showcase-cta-button" href={LANDING_URL}>
            Try it out
          </a>
        </section>
      )}

      <footer className="showcase-footer">
        <span>Made with Bookplate</span>
        {reportHref && <a href={reportHref}>Report this page</a>}
      </footer>
    </main>
  );
}
