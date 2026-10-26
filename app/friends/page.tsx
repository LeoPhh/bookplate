import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import FriendsPanel from "@/components/FriendsPanel";
import { getSession } from "@/lib/auth";
import { config } from "@/lib/config";
import { listBlocked, listFriends, listRequests } from "@/lib/social/friends";
import { listInvites } from "@/lib/social/invites";
import { listNotifications, markAllRead } from "@/lib/social/notifications";
import { getProfile } from "@/lib/social/profile";
import { listInbox, listSent, markRecsSeen } from "@/lib/social/recs";

// The Friends tab (SOCIAL=true servers). Opening it counts as having seen the
// news, which clears the badge.
export default async function FriendsPage() {
  await connection();
  if (!config.social) notFound();
  const session = await getSession();
  if (!session) redirect("/login");
  const userId = session.user.id;
  const [friends, requests, invites, blocked, notifications, profile, inbox, sent] = await Promise.all([
    listFriends(userId),
    listRequests(userId),
    listInvites(userId),
    listBlocked(userId),
    listNotifications(userId),
    getProfile(userId),
    listInbox(userId),
    listSent(userId),
  ]);
  if (notifications.some((n) => !n.read)) await markAllRead(userId);
  if (inbox.some((r) => r.state === "new")) await markRecsSeen(userId);

  return (
    <main className="page">
      <header className="masthead">
        <p className="masthead-eyebrow">Your Own Personal, Digital Library</p>
        <h1 className="masthead-title">Friends</h1>
      </header>
      <FriendsPanel
        data={{ friends, ...requests, invites, blocked, notifications, inbox, sent, hasProfile: Boolean(profile) }}
        inviteBase={config.publicUrl}
      />
      <footer className="colophon">— ex libris —</footer>
    </main>
  );
}
