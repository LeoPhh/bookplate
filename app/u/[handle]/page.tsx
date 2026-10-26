import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import ProfileActions from "@/components/ProfileActions";
import ProfileView from "@/components/ProfileView";
import { getSession } from "@/lib/auth";
import { config, CONTACT_EMAIL } from "@/lib/config";
import { todayIso } from "@/lib/progress";
import { standing } from "@/lib/social/friends";
import { findPerson, loadPersonView } from "@/lib/social/people";
import { FIRST_YEAR } from "@/lib/showcase";

// A reader's profile (lib/social/people.ts), for whoever may see it: the
// reader, their friends, and anyone at all when it's public. Everyone else
// gets "not found", the same as for a handle nobody has.

const LANDING_URL = "https://bookplate.eu";

type Props = { params: Promise<{ handle: string }>; searchParams: Promise<{ year?: string }> };

const load = cache(async (handle: string) => {
  if (!config.social) return null;
  const session = await getSession().catch(() => null);
  const person = await findPerson(session?.user.id ?? null, handle);
  return person ? { person, viewerId: session?.user.id ?? null } : null;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await connection();
  const found = await load((await params).handle);
  // Only people given the link should find it.
  const robots = { index: false, follow: false };
  if (!found) return { title: "Bookplate", robots };
  const { name, profile } = found.person;
  const title = `${name ? `${name} (@${profile.handle})` : `@${profile.handle}`} · Bookplate`;
  const description = profile.bio ?? "Reading, kept on Bookplate.";
  return {
    title,
    description,
    robots,
    // Link previews come from a signed-out fetch: only public profiles get one
    // (card/ answers "not found" for the rest).
    ...(profile.visibility === "public"
      ? (() => {
          const images = [{ url: `/u/${profile.handle}/card`, width: 1200, height: 630, alt: "A reader’s profile on Bookplate" }];
          return {
            metadataBase: new URL(config.publicUrl),
            openGraph: { title, description, type: "profile" as const, siteName: "Bookplate", images },
            twitter: { card: "summary_large_image" as const, title, description, images },
          };
        })()
      : {}),
  };
}

export default async function PersonPage({ params, searchParams }: Props) {
  await connection();
  const { handle } = await params;
  const found = await load(handle);
  if (!found) notFound();
  const { person, viewerId } = found;
  const signedIn = viewerId !== null;
  const today = todayIso();
  const thisYear = Number(today.slice(0, 4));
  const asked = Number((await searchParams).year);
  const year = Number.isInteger(asked) && asked >= FIRST_YEAR && asked <= thisYear ? asked : thisYear;
  const { stats, taste } = await loadPersonView(person, { year, viewerId });
  const base = `/u/${person.profile.handle}`;

  const reportHref =
    CONTACT_EMAIL && person.audience !== "self"
      ? `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Report a profile")}&body=${encodeURIComponent(
          `${config.publicUrl}${base}\n\nWhat's wrong with it:\n`,
        )}`
      : null;

  return (
    <main className="page showcase profile-page">
      <ProfileView
        person={person}
        stats={stats}
        taste={taste}
        today={today}
        yearHref={(y) => (y === thisYear ? base : `${base}?year=${y}`)}
        actions={
          viewerId && person.audience !== "self" ? (
            <ProfileActions
              id={person.userId}
              handle={person.profile.handle}
              name={person.name || `@${person.profile.handle}`}
              standing={await standing(viewerId, person.userId)}
            />
          ) : null
        }
      />

      {!signedIn && (
        <section className="showcase-cta">
          <p className="showcase-cta-title">Keep a library like this one.</p>
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
        {reportHref && <a href={reportHref}>Report this profile</a>}
      </footer>
    </main>
  );
}
