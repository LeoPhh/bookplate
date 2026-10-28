import { and, eq, inArray, lt, or, sql } from "drizzle-orm";
import { countUp } from "../authThrottle";
import { getDb, schema } from "../db";
import { audienceFor, pairOf } from "./access";
import { FriendError } from "./errors";
import { notify, unnotify } from "./notifications";
import { findHandle } from "./profile";
import { profileAvatar } from "./projection";
import { dropWaiting } from "./recs";

// Friendships: both readers agreed, by answering a request. Blocking ends a friendship and any
// request between the two, and stops new ones either way.
//
// Other readers are named by their account id here. It's no secret, but it's
// only ever shown to readers already connected to them (a request, a
// friendship, a notification) or who can see their profile.

const { friendship, friendRequest, block, user, profile } = schema;

export { FriendError };

// Someone as a list of friends or requests shows them.
export interface Someone {
  id: string;
  name: string;
  handle: string | null; // null: no profile, so nothing to link to
  image: string | null; // at their profile's address
  since: string; // when the friendship or request began
}

export const REQUESTS_PER_DAY = 20;
export const REQUEST_DAYS = 30; // unanswered requests go after this long
const DAY_MS = 24 * 60 * 60 * 1000;

async function people(rows: { id: string; since: Date }[]): Promise<Someone[]> {
  if (rows.length === 0) return [];
  const found = await getDb()
    .select({ id: user.id, name: user.name, image: user.image, handle: profile.handle })
    .from(user)
    .leftJoin(profile, eq(profile.userId, user.id))
    .where(
      inArray(
        user.id,
        rows.map((r) => r.id)
      )
    );
  const byId = new Map(found.map((f) => [f.id, f]));
  return rows
    .filter((r) => byId.has(r.id))
    .map((r) => {
      const f = byId.get(r.id)!;
      const handle = f.handle;
      return { id: r.id, name: f.name, handle, image: handle ? profileAvatar(handle, f.image) : null, since: r.since.toISOString() };
    })
    .sort((a, b) => (a.name || a.handle || "").localeCompare(b.name || b.handle || ""));
}

export async function listFriends(userId: string): Promise<Someone[]> {
  const rows = await getDb()
    .select({
      id: sql<string>`CASE WHEN ${friendship.userA} = ${userId} THEN ${friendship.userB} ELSE ${friendship.userA} END`,
      since: friendship.createdAt,
    })
    .from(friendship)
    .where(or(eq(friendship.userA, userId), eq(friendship.userB, userId)));
  return people(rows);
}

// A reader's friends as someone else sees them on their profile: all of them,
// as profiles are open to everyone, except anyone blocked either way with the
// viewer (lib/social/access.ts).
export async function friendsSeenBy(viewerId: string | null, ownerId: string): Promise<Someone[]> {
  if (viewerId === ownerId) return listFriends(ownerId);
  const { rows } = await getDb().execute<{ id: string; since: Date | string }>(sql`
    SELECT u.id, f.created_at AS since
    FROM friendship f
    JOIN "user" u ON u.id = CASE WHEN f.user_a = ${ownerId} THEN f.user_b ELSE f.user_a END
    WHERE (f.user_a = ${ownerId} OR f.user_b = ${ownerId})
      AND NOT EXISTS (
        SELECT 1 FROM block b
        WHERE (b.blocker = ${viewerId} AND b.blocked = u.id) OR (b.blocker = u.id AND b.blocked = ${viewerId}))`);
  return people(rows.map((r) => ({ id: r.id, since: new Date(r.since) })));
}

export async function listRequests(userId: string): Promise<{ incoming: Someone[]; outgoing: Someone[] }> {
  const db = getDb();
  const [incoming, outgoing] = await Promise.all([
    db.select({ id: friendRequest.fromUser, since: friendRequest.createdAt }).from(friendRequest).where(eq(friendRequest.toUser, userId)),
    db.select({ id: friendRequest.toUser, since: friendRequest.createdAt }).from(friendRequest).where(eq(friendRequest.fromUser, userId)),
  ]);
  return { incoming: await people(incoming), outgoing: await people(outgoing) };
}

// Where two readers stand, for the buttons on a profile: friends, a request
// one way or the other, or nothing yet.
export async function standing(viewerId: string, otherId: string): Promise<"friends" | "sent" | "received" | "none"> {
  const [a, b] = pairOf(viewerId, otherId);
  const { rows } = await getDb().execute<{ friends: boolean; sent: boolean; received: boolean }>(sql`
    SELECT
      EXISTS (SELECT 1 FROM friendship WHERE user_a = ${a} AND user_b = ${b}) AS friends,
      EXISTS (SELECT 1 FROM friend_request WHERE from_user = ${viewerId} AND to_user = ${otherId}) AS sent,
      EXISTS (SELECT 1 FROM friend_request WHERE from_user = ${otherId} AND to_user = ${viewerId}) AS received`);
  const r = rows[0];
  return r?.friends ? "friends" : r?.sent ? "sent" : r?.received ? "received" : "none";
}

export async function countFriends(): Promise<number> {
  const [row] = await getDb().select({ n: sql<number>`count(*)` }).from(friendship);
  return Number(row.n);
}

// Makes two readers friends (both have agreed), clearing any request between
// them. Returns false when they already were.
export async function befriend(a: string, b: string): Promise<boolean> {
  const [x, y] = pairOf(a, b);
  return getDb().transaction(async (tx) => {
    await tx
      .delete(friendRequest)
      .where(
        or(
          and(eq(friendRequest.fromUser, a), eq(friendRequest.toUser, b)),
          and(eq(friendRequest.fromUser, b), eq(friendRequest.toUser, a))
        )
      );
    await unnotify(a, "friend_request", b, tx);
    await unnotify(b, "friend_request", a, tx);
    const made = await tx.insert(friendship).values({ userA: x, userB: y }).onConflictDoNothing().returning();
    return made.length > 0;
  });
}

export type RequestResult = "sent" | "friends" | "already";

// Asks the reader behind a handle to be friends. A request the other way
// already waiting makes them friends at once. Anyone who can't be found
// (no such username, a block either way) gets the same answer.
export async function sendRequest(fromId: string, handle: string): Promise<{ result: RequestResult; to: string }> {
  const found = await findHandle(handle);
  const notFound = new FriendError("Nobody has that username.", 404);
  if (!found) throw notFound;
  const toId = found.userId;
  if (toId === fromId) throw new FriendError("That’s you.");
  const audience = await audienceFor(fromId, toId);
  if (audience === "blocked") throw notFound;
  if (audience === "friend") return { result: "already", to: toId };

  const db = getDb();
  const [reverse] = await db
    .select()
    .from(friendRequest)
    .where(and(eq(friendRequest.fromUser, toId), eq(friendRequest.toUser, fromId)));
  if (reverse) {
    await befriend(fromId, toId);
    await notify(toId, "friend_accepted", fromId);
    return { result: "friends", to: toId };
  }

  if ((await countUp(`friend-request:${fromId}`, DAY_MS)) > REQUESTS_PER_DAY) {
    throw new FriendError("That’s a lot of requests for one day. Try again tomorrow.", 429);
  }
  const made = await db.insert(friendRequest).values({ fromUser: fromId, toUser: toId }).onConflictDoNothing().returning();
  if (made.length) await notify(toId, "friend_request", fromId);
  return { result: "sent", to: toId };
}

// Accepts or declines a request someone sent. Declining tells them nothing.
export async function answerRequest(userId: string, fromId: string, accept: boolean): Promise<void> {
  const [req] = await getDb()
    .select()
    .from(friendRequest)
    .where(and(eq(friendRequest.fromUser, fromId), eq(friendRequest.toUser, userId)));
  if (!req) throw new FriendError("No such request.", 404);
  if (accept) {
    await befriend(userId, fromId);
    await notify(fromId, "friend_accepted", userId);
  } else {
    await getDb().delete(friendRequest).where(and(eq(friendRequest.fromUser, fromId), eq(friendRequest.toUser, userId)));
    await unnotify(userId, "friend_request", fromId);
  }
}

// Takes back a request the reader sent.
export async function withdrawRequest(userId: string, toId: string): Promise<boolean> {
  const gone = await getDb()
    .delete(friendRequest)
    .where(and(eq(friendRequest.fromUser, userId), eq(friendRequest.toUser, toId)))
    .returning();
  if (gone.length) await unnotify(toId, "friend_request", userId);
  return gone.length > 0;
}

export async function unfriend(userId: string, otherId: string): Promise<boolean> {
  const [a, b] = pairOf(userId, otherId);
  return getDb().transaction(async (tx) => {
    const gone = await tx
      .delete(friendship)
      .where(and(eq(friendship.userA, a), eq(friendship.userB, b)))
      .returning();
    if (gone.length) await dropWaiting(userId, otherId, tx);
    return gone.length > 0;
  });
}

// ── Blocks ─────────────────────────────────────────────────────────────────

export async function blockUser(userId: string, otherId: string): Promise<void> {
  if (userId === otherId) throw new FriendError("That’s you.");
  const [exists] = await getDb().select({ id: user.id }).from(user).where(eq(user.id, otherId));
  if (!exists) throw new FriendError("No such reader.", 404);
  const [a, b] = pairOf(userId, otherId);
  await getDb().transaction(async (tx) => {
    await tx.insert(block).values({ blocker: userId, blocked: otherId }).onConflictDoNothing();
    await tx.delete(friendship).where(and(eq(friendship.userA, a), eq(friendship.userB, b)));
    await tx
      .delete(friendRequest)
      .where(
        or(
          and(eq(friendRequest.fromUser, userId), eq(friendRequest.toUser, otherId)),
          and(eq(friendRequest.fromUser, otherId), eq(friendRequest.toUser, userId))
        )
      );
    await dropWaiting(userId, otherId, tx);
    // Nothing from them stays in the reader's notifications.
    await tx
      .delete(schema.notification)
      .where(and(eq(schema.notification.userId, userId), eq(schema.notification.actorId, otherId)));
  });
}

export async function unblockUser(userId: string, otherId: string): Promise<boolean> {
  const gone = await getDb()
    .delete(block)
    .where(and(eq(block.blocker, userId), eq(block.blocked, otherId)))
    .returning();
  return gone.length > 0;
}

// The readers this reader has blocked, to unblock them in Settings.
export async function listBlocked(userId: string): Promise<{ id: string; name: string; handle: string | null }[]> {
  const rows = await getDb()
    .select({ id: user.id, name: user.name, handle: profile.handle })
    .from(block)
    .innerJoin(user, eq(user.id, block.blocked))
    .leftJoin(profile, eq(profile.userId, block.blocked))
    .where(eq(block.blocker, userId));
  return rows;
}

// Housekeeping: requests nobody answered go after REQUEST_DAYS.
export async function pruneRequests(): Promise<number> {
  const gone = await getDb()
    .delete(friendRequest)
    .where(lt(friendRequest.createdAt, sql`now() - ${sql.raw(`interval '${REQUEST_DAYS} days'`)}`))
    .returning();
  return gone.length;
}
