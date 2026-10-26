import { randomBytes } from "crypto";
import { and, eq, gt, lt, or, sql } from "drizzle-orm";
import { countUp } from "../authThrottle";
import { getDb, schema } from "../db";
import { audienceFor } from "./access";
import { FriendError } from "./errors";
import { befriend } from "./friends";
import { notify } from "./notifications";

// Invite links, /f/<token>: a reader makes one and sends it however they
// like; whoever opens it, signed in (or after signing up), becomes their
// friend in one step: making the link was the inviter's half of agreeing.
// The token is the whole key, like a showcase id, so it's long, random and
// never logged. A link works for INVITE_DAYS, any number of times, until
// its maker takes it back.

export const INVITE_DAYS = 7;
export const INVITES_PER_DAY = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

const { friendInvite, user, profile } = schema;

const newToken = () => randomBytes(12).toString("base64url");
export const isInviteToken = (t: string) => /^[A-Za-z0-9_-]{16}$/.test(t);

export interface Invite {
  token: string;
  expiresAt: string;
}

export async function createInvite(userId: string): Promise<Invite> {
  if ((await countUp(`invite:${userId}`, DAY_MS)) > INVITES_PER_DAY) {
    throw new FriendError("That’s a lot of invite links for one day. Try again tomorrow.", 429);
  }
  const [row] = await getDb()
    .insert(friendInvite)
    .values({ token: newToken(), userId, expiresAt: sql`now() + ${sql.raw(`interval '${INVITE_DAYS} days'`)}` })
    .returning();
  return { token: row.token, expiresAt: row.expiresAt.toISOString() };
}

export async function listInvites(userId: string): Promise<Invite[]> {
  const rows = await getDb()
    .select()
    .from(friendInvite)
    .where(and(eq(friendInvite.userId, userId), gt(friendInvite.expiresAt, sql`now()`)))
    .orderBy(friendInvite.createdAt);
  return rows.map((r) => ({ token: r.token, expiresAt: r.expiresAt.toISOString() }));
}

export async function revokeInvite(userId: string, token: string): Promise<boolean> {
  const gone = await getDb()
    .delete(friendInvite)
    .where(and(eq(friendInvite.userId, userId), eq(friendInvite.token, token)))
    .returning();
  return gone.length > 0;
}

// Who an invite is from, for its page, or null when it doesn't work (no such
// link, run out, or taken back).
export async function findInvite(token: string): Promise<{ userId: string; name: string; handle: string | null } | null> {
  if (!isInviteToken(token)) return null;
  const [row] = await getDb()
    .select({ userId: friendInvite.userId, name: user.name, handle: profile.handle, visibility: profile.visibility, usesLeft: friendInvite.usesLeft })
    .from(friendInvite)
    .innerJoin(user, eq(user.id, friendInvite.userId))
    .leftJoin(profile, eq(profile.userId, friendInvite.userId))
    .where(
      and(
        eq(friendInvite.token, token),
        gt(friendInvite.expiresAt, sql`now()`),
        or(sql`${friendInvite.usesLeft} IS NULL`, gt(friendInvite.usesLeft, 0))
      )
    );
  if (!row) return null;
  return { userId: row.userId, name: row.name, handle: row.handle && row.visibility !== "private" ? row.handle : null };
}

export type InviteResult = "friends" | "already" | "own";

// The signed-in reader takes up an invite: they become the inviter's friend.
// A block either way makes the link look like it doesn't work.
export async function acceptInvite(userId: string, token: string): Promise<{ result: InviteResult; inviter: string }> {
  const invite = await findInvite(token);
  if (!invite) throw new FriendError("This invite link doesn’t work any more.", 404);
  if (invite.userId === userId) return { result: "own", inviter: invite.userId };
  const audience = await audienceFor(userId, invite.userId);
  if (audience === "blocked") throw new FriendError("This invite link doesn’t work any more.", 404);
  if (audience === "friend") return { result: "already", inviter: invite.userId };
  await getDb()
    .update(friendInvite)
    .set({ usesLeft: sql`${friendInvite.usesLeft} - 1` })
    .where(and(eq(friendInvite.token, token), sql`${friendInvite.usesLeft} IS NOT NULL`));
  await befriend(userId, invite.userId);
  await notify(invite.userId, "friend_accepted", userId);
  return { result: "friends", inviter: invite.userId };
}

// Housekeeping: links that ran out over a day ago.
export async function pruneInvites(): Promise<number> {
  const gone = await getDb()
    .delete(friendInvite)
    .where(lt(friendInvite.expiresAt, sql`now() - interval '1 day'`))
    .returning();
  return gone.length;
}
