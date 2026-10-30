import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import ProfileActions from "@/components/ProfileActions";
import ProfileView from "@/components/ProfileView";
import { getSession } from "@/lib/auth";
import { config, CONTACT_EMAIL } from "@/lib/config";
import { todayIso } from "@/lib/progress";
import { friendsSeenBy, standing } from "@/lib/social/friends";
import { unreadCount } from "@/lib/social/notifications";
import { findPerson, loadPersonView } from "@/lib/social/people";

// A reader's profile (lib/social/people.ts), for whoever may see it: the
// reader, their friends, and anyone at all when it's public. Everyone else
// gets "not found", the same as for a handle nobody has.

const LANDING_URL = "https://bookplate.eu";

type Props = { params: Promise<{ handle: string }> };

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

export default async function PersonPage({ params }: Props) {
  await connection();
  const { handle } = await params;
  const found = await load(handle);
  if (!found) notFound();
  const { person, viewerId } = found;
  const signedIn = viewerId !== null;
  const self = person.audience === "self";
  const [{ stats, taste, finished, goal }, friends, news] = await Promise.all([
    loadPersonView(person, { viewerId }),
    friendsSeenBy(viewerId, person.userId),
    self ? unreadCount(person.userId) : 0,
  ]);
  const base = `/u/${person.profile.handle}`;

  const reportHref =
    CONTACT_EMAIL && !self
      ? `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Report a profile")}&body=${encodeURIComponent(
          `${config.publicUrl}${base}\n\nWhat's wrong with it:\n`,
        )}`
      : null;

  return (
    <main className="page profile-page">
      <ProfileView
        person={person}
        stats={stats}
        taste={taste}
        finished={finished}
        goal={goal}
        today={todayIso()}
        friends={{ all: friends, href: `${base}/friends`, news }}
        shareUrl={self ? `${config.publicUrl}${base}` : undefined}
        actions={
          viewerId && !self ? (
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
        <section className="profile-closer">
          <h2>Made with Bookplate</h2>
          <p>Your books, your notes and your reading life, all on one shelf.</p>
          <div className="profile-closer-cta">
            {config.registration === "open" && (
              <a className="btn btn--accent" href={`/signup?next=${encodeURIComponent(base)}`}>
                Create a free account
              </a>
            )}
            <a className="btn" href={LANDING_URL}>
              Learn more
            </a>
          </div>
        </section>
      )}

      {reportHref && (
        <footer className="profile-footer">
          <a href={reportHref}>Report this profile</a>
        </footer>
      )}
    </main>
  );
}
