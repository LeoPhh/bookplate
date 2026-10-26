import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import InviteAccept from "@/components/InviteAccept";
import { getSession } from "@/lib/auth";
import { config } from "@/lib/config";
import { audienceFor } from "@/lib/social/access";
import { findInvite } from "@/lib/social/invites";

// An invite link (lib/social/invites.ts). Visitors see who it's from and are
// asked to sign up or in, coming back here after; readers signed in take it
// up with one button. A link that doesn't work, or is from someone blocked
// either way, is "not found".

type Props = { params: Promise<{ token: string }> };

export const metadata: Metadata = {
  title: "An invitation · Bookplate",
  robots: { index: false, follow: false },
};

export default async function InvitePage({ params }: Props) {
  await connection();
  if (!config.social) notFound();
  const { token } = await params;
  const invite = await findInvite(token);
  if (!invite) notFound();
  const session = await getSession().catch(() => null);
  const audience = session ? await audienceFor(session.user.id, invite.userId) : "stranger";
  if (audience === "blocked") notFound();

  const who = invite.name || (invite.handle ? `@${invite.handle}` : "A Bookplate reader");
  const here = `/f/${token}`;
  const profileLink = invite.handle ? <a href={`/u/${invite.handle}`}>their profile</a> : null;

  return (
    <main className="page showcase invite">
      <section className="showcase-plate">
        <p className="showcase-plate-eyebrow">An invitation</p>
        <h1 className="showcase-plate-name invite-name">{who}</h1>
        <p className="showcase-plate-edition">would like to be friends on Bookplate</p>
      </section>

      <section className="showcase-cta invite-cta">
        {audience === "self" ? (
          <p className="showcase-cta-text">
            This is your own invite link. Send it to someone you&rsquo;d like to be friends with; anyone who opens it
            in the next few days becomes your friend.
          </p>
        ) : audience === "friend" ? (
          <p className="showcase-cta-text">You&rsquo;re friends already{profileLink ? <>. See {profileLink}.</> : "."}</p>
        ) : session ? (
          <>
            <p className="showcase-cta-text">
              Friends see each other&rsquo;s profiles: what you&rsquo;ve read, what you&rsquo;re reading and your year
              in books. Never your notes, words or email.
            </p>
            <InviteAccept token={token} label={`Be friends with ${who}`} />
          </>
        ) : (
          <>
            <p className="showcase-cta-text">
              Bookplate is a home for your books, your notes on them and the words you learn along the way. Friends
              see each other&rsquo;s reading, never their notes.
            </p>
            <div className="invite-actions">
              {config.registration === "open" && (
                <a className="btn btn--accent showcase-cta-button" href={`/signup?next=${encodeURIComponent(here)}`}>
                  Create an account
                </a>
              )}
              <a className="btn showcase-cta-button" href={`/login?next=${encodeURIComponent(here)}`}>
                Sign in
              </a>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
