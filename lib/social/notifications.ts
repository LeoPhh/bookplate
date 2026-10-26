import { randomUUID } from "crypto";
import { and, desc, eq, isNull, lt, sql } from "drizzle-orm";
import { getDb, schema } from "../db";

// Things for a reader to see: a friend request, a request accepted, and later
// recommendations, club invites, replies… `kind` says which; `objectRef`
// points at what it's about, its meaning depending on the kind. The badge on
// the Friends tab counts the unread ones.

export type NotificationKind = "friend_request" | "friend_accepted" | "recommendation";

export interface Notification {
  id: string;
  kind: NotificationKind;
  actor: { id: string; name: string; handle: string | null } | null;
  objectRef: string | null;
  createdAt: string;
  read: boolean;
}

const { notification, user, profile } = schema;

type Db = ReturnType<typeof getDb> | Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

export async function notify(
  userId: string,
  kind: NotificationKind,
  actorId: string | null,
  objectRef: string | null = null,
  db: Db = getDb()
): Promise<void> {
  await db.insert(notification).values({ id: randomUUID(), userId, kind, actorId, objectRef });
}

// Takes back a notification that no longer applies (a request withdrawn or
// answered), so it doesn't sit in the badge.
export async function unnotify(userId: string, kind: NotificationKind, actorId: string, db: Db = getDb()): Promise<void> {
  await db
    .delete(notification)
    .where(and(eq(notification.userId, userId), eq(notification.kind, kind), eq(notification.actorId, actorId)));
}

export const LIST_MAX = 50;

export async function listNotifications(userId: string): Promise<Notification[]> {
  const rows = await getDb()
    .select({
      id: notification.id,
      kind: notification.kind,
      objectRef: notification.objectRef,
      createdAt: notification.createdAt,
      readAt: notification.readAt,
      actorId: notification.actorId,
      actorName: user.name,
      actorHandle: profile.handle,
    })
    .from(notification)
    .leftJoin(user, eq(user.id, notification.actorId))
    .leftJoin(profile, eq(profile.userId, notification.actorId))
    .where(eq(notification.userId, userId))
    .orderBy(desc(notification.createdAt))
    .limit(LIST_MAX);
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as NotificationKind,
    actor: r.actorId ? { id: r.actorId, name: r.actorName ?? "", handle: r.actorHandle } : null,
    objectRef: r.objectRef,
    createdAt: r.createdAt.toISOString(),
    read: r.readAt !== null,
  }));
}

export async function unreadCount(userId: string): Promise<number> {
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)` })
    .from(notification)
    .where(and(eq(notification.userId, userId), isNull(notification.readAt)));
  return Number(row?.n ?? 0);
}

export async function markAllRead(userId: string): Promise<void> {
  await getDb()
    .update(notification)
    .set({ readAt: sql`now()` })
    .where(and(eq(notification.userId, userId), isNull(notification.readAt)));
}

// Housekeeping: read notifications go after 90 days.
export async function pruneNotifications(): Promise<number> {
  const gone = await getDb()
    .delete(notification)
    .where(lt(notification.readAt, sql`now() - interval '90 days'`))
    .returning({ id: notification.id });
  return gone.length;
}
