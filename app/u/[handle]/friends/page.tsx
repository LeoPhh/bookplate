import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import Avatar from "@/components/Avatar";
import FriendsPanel from "@/components/FriendsPanel";
import { getSession } from "@/lib/auth";
import { config } from "@/lib/config";
import { plural } from "@/lib/progress";
import { friendsSeenBy, listFriends, listRequests } from "@/lib/social/friends";
import { listNotifications, markAllRead } from "@/lib/social/notifications";
import { findPerson } from "@/lib/social/people";
import { listInbox, listSent, markRecsSeen } from "@/lib/social/recs";

// A reader's friends, for whoever may see the profile: all of them, less anyone
// blocked with the viewer (lib/social/friends.ts friendsSeenBy). The Friends
// tile on someone else's profile shows the same list in a dialog; this page is
// for opening it in its own tab. The reader's own page is where they
// manage it all (components/FriendsPanel.tsx); opening it counts as having
// seen the news, which clears the badge on Profile.

type Props = { params: Promise<{ handle: string }> };

export const metadata: Metadata = { title: "Friends · Bookplate", robots: { index: false, follow: false } };

export default async function FriendsPage({ params }: Props) {
  await connection();
  if (!config.social) notFound();
  const session = await getSession().catch(() => null);
  const viewerId = session?.user.id ?? null;
  const person = await findPerson(viewerId, (await params).handle);
  if (!person) notFound();
  const who = person.name || `@${person.profile.handle}`;
  const back = (
    <a className="profile-back" href={`/u/${person.profile.handle}`}>
      {`← ${who}`}
    </a>
  );

  if (person.audience === "self") {
    const userId = person.userId;
    const [friends, requests, notifications, inbox, sent] = await Promise.all([
      listFriends(userId),
      listRequests(userId),
      listNotifications(userId),
      listInbox(userId),
      listSent(userId),
    ]);
    if (notifications.some((n) => !n.read)) await markAllRead(userId);
    if (inbox.some((r) => r.state === "new")) await markRecsSeen(userId);
    return (
      <main className="page">
        <header className="masthead">
          {back}
          <h1 className="masthead-title">Friends</h1>
        </header>
        <FriendsPanel data={{ friends, ...requests, notifications, inbox, sent }} />
        <footer className="colophon">— ex libris —</footer>
      </main>
    );
  }

  const friends = await friendsSeenBy(viewerId, person.userId);
  return (
    <main className="page">
      <header className="masthead">
        {back}
        <h1 className="masthead-title">{`${who}’s friends`}</h1>
      </header>
      <div className="friends">
        <section className="settings-section">
          {friends.length === 0 ? (
            <p className="settings-lede">No friends to show.</p>
          ) : (
            <>
              <h2 className="form-heading">{plural(friends.length, "friend")}</h2>
              <ul className="friend-list">
                {friends.map((f) => (
                  <li key={f.id} className="friend">
                    <Avatar image={f.image} label={f.name || f.handle} color={f.color} size={44} />
                    <span className="friend-who">
                      {f.handle ? (
                        <a className="friend-name" href={`/u/${f.handle}`}>
                          {f.name || `@${f.handle}`}
                        </a>
                      ) : (
                        <span className="friend-name">{f.name || "A reader"}</span>
                      )}
                      {f.handle && f.name && <span className="friend-handle">{`@${f.handle}`}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
      <footer className="colophon">— ex libris —</footer>
    </main>
  );
}
