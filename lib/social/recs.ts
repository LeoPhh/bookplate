import { randomUUID } from "crypto";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { countUp } from "../authThrottle";
import { getDb, schema } from "../db";
import { listBooks, upsertBook } from "../library";
import { checkNewBooks } from "../limits";
import { isWorkId } from "../openLibrary";
import { PALETTE } from "../palette";
import { audienceFor } from "./access";
import { FriendError } from "./errors";
import { notify } from "./notifications";
import { profileAvatar } from "./projection";
import { workKey } from "./workKey";

// Recommendations: one friend suggests a book to another, with a note if
// they like. It isn't in the recipient's library until they add it (to their
// to-read shelf, within the server's book limit); or they can say it's not
// for them. The sender sees whether it was added, nothing more. Unfriending
// or blocking takes back any still waiting, either way.

export type RecState = "new" | "seen" | "added" | "dismissed";

export interface RecBook {
  title: string;
  author: string;
  isbn?: string;
  olWorkId?: string;
}

export interface Recommendation extends RecBook {
  id: string;
  note: string | null;
  state: RecState;
  createdAt: string;
  // The other reader: who sent it (inbox) or who it went to (sent).
  who: { id: string; name: string; handle: string | null; image: string | null };
  inLibrary?: boolean; // inbox only: the recipient has this book already
}

export const NOTE_MAX = 280;
export const TITLE_MAX = 300;
export const AUTHOR_MAX = 200;
export const PER_DAY = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const { recommendation, user, profile } = schema;

const oneLine = (s: string) => s.replace(/\s+/g, " ").replace(/[\p{Cc}\p{Cf}]/gu, "").trim();

// Checks what the Recommend dialog sends.
export function parseRecommendation(body: Record<string, unknown>): RecBook & { to: string; note: string | null } {
  const { to, title, author, isbn, olWorkId, note } = body;
  if (typeof to !== "string" || !to) throw new FriendError("Who to?");
  if (typeof title !== "string" || !oneLine(title)) throw new FriendError("Which book?");
  if (typeof author !== "string") throw new FriendError("Who wrote it?");
  const t = oneLine(title);
  const a = oneLine(author);
  if (t.length > TITLE_MAX || a.length > AUTHOR_MAX) throw new FriendError("That title or author is too long.");
  if (isbn !== undefined && isbn !== null && (typeof isbn !== "string" || !/^[0-9X-]{10,17}$/i.test(isbn))) {
    throw new FriendError("Invalid ISBN.");
  }
  if (olWorkId !== undefined && olWorkId !== null && !isWorkId(olWorkId)) throw new FriendError("Invalid work id.");
  if (note !== undefined && note !== null && typeof note !== "string") throw new FriendError("Invalid note.");
  const n = oneLine((note as string | null | undefined) ?? "");
  if ([...n].length > NOTE_MAX) throw new FriendError(`Keep the note to ${NOTE_MAX} characters.`);
  return {
    to,
    title: t,
    author: a,
    isbn: (isbn as string | undefined)?.replace(/-/g, "") || undefined,
    olWorkId: (olWorkId as string | undefined) || undefined,
    note: n || null,
  };
}

export async function sendRecommendation(fromId: string, r: RecBook & { to: string; note: string | null }): Promise<string> {
  if (r.to === fromId) throw new FriendError("That’s you.");
  if ((await audienceFor(fromId, r.to)) !== "friend") throw new FriendError("You can only recommend books to friends.", 404);
  const key = workKey(r);
  const db = getDb();
  const [waiting] = await db
    .select({ id: recommendation.id })
    .from(recommendation)
    .where(
      and(
        eq(recommendation.fromUser, fromId),
        eq(recommendation.toUser, r.to),
        eq(recommendation.workKey, key),
        inArray(recommendation.state, ["new", "seen"])
      )
    );
  if (waiting) throw new FriendError("You’ve recommended them this one already.", 409);
  if ((await countUp(`recommend:${fromId}`, DAY_MS)) > PER_DAY) {
    throw new FriendError("That’s a lot of recommendations for one day. Try again tomorrow.", 429);
  }
  const id = randomUUID();
  await db.insert(recommendation).values({
    id,
    fromUser: fromId,
    toUser: r.to,
    title: r.title,
    author: r.author,
    isbn: r.isbn ?? null,
    olWorkId: r.olWorkId ?? null,
    workKey: key,
    note: r.note,
  });
  await notify(r.to, "recommendation", fromId, id);
  return id;
}

type Row = typeof recommendation.$inferSelect;

async function withPeople(rows: Row[], other: (r: Row) => string): Promise<Recommendation[]> {
  if (rows.length === 0) return [];
  const people = await getDb()
    .select({ id: user.id, name: user.name, image: user.image, handle: profile.handle, visibility: profile.visibility })
    .from(user)
    .leftJoin(profile, eq(profile.userId, user.id))
    .where(inArray(user.id, [...new Set(rows.map(other))]));
  const byId = new Map(people.map((p) => [p.id, p]));
  return rows.map((r) => {
    const p = byId.get(other(r));
    const handle = p?.handle && p.visibility !== "private" ? p.handle : null;
    return {
      id: r.id,
      title: r.title,
      author: r.author,
      isbn: r.isbn ?? undefined,
      olWorkId: r.olWorkId ?? undefined,
      note: r.note,
      state: r.state as RecState,
      createdAt: r.createdAt.toISOString(),
      who: { id: other(r), name: p?.name ?? "", handle, image: handle ? profileAvatar(handle, p?.image) : null },
    };
  });
}

// What friends recommended to the reader and they haven't answered yet,
// newest first, each marked when it's in their library already.
export async function listInbox(userId: string): Promise<Recommendation[]> {
  const rows = await getDb()
    .select()
    .from(recommendation)
    .where(and(eq(recommendation.toUser, userId), inArray(recommendation.state, ["new", "seen"])))
    .orderBy(desc(recommendation.createdAt));
  const mine = new Set((await listBooks(userId)).map(workKey));
  return (await withPeople(rows, (r) => r.fromUser)).map((r, i) => ({ ...r, inLibrary: mine.has(rows[i].workKey) }));
}

// What the reader recommended, newest first. Not for them? It just shows as
// seen: the sender isn't told.
export async function listSent(userId: string): Promise<Recommendation[]> {
  const rows = await getDb()
    .select()
    .from(recommendation)
    .where(eq(recommendation.fromUser, userId))
    .orderBy(desc(recommendation.createdAt))
    .limit(50);
  return (await withPeople(rows, (r) => r.toUser)).map((r) => (r.state === "dismissed" ? { ...r, state: "seen" } : r));
}

// The inbox has been looked at.
export async function markRecsSeen(userId: string): Promise<void> {
  await getDb()
    .update(recommendation)
    .set({ state: "seen", updatedAt: sql`now()` })
    .where(and(eq(recommendation.toUser, userId), eq(recommendation.state, "new")));
}

async function received(userId: string, id: string): Promise<Row> {
  const [row] = await getDb()
    .select()
    .from(recommendation)
    .where(and(eq(recommendation.id, id), eq(recommendation.toUser, userId), inArray(recommendation.state, ["new", "seen"])));
  if (!row) throw new FriendError("No such recommendation.", 404);
  return row;
}

// Adds a recommended book to the reader's to-read shelf, or, when they have
// it already, just says so. Returns the book's id.
export async function addRecommendation(userId: string, id: string): Promise<string> {
  const row = await received(userId, id);
  const books = await listBooks(userId);
  let bookId = books.find((b) => workKey(b) === row.workKey)?.id;
  if (!bookId) {
    const over = await checkNewBooks(userId, 1);
    if (over) throw new FriendError(over, 403); // like overLimit in lib/limits.ts
    bookId = randomUUID();
    // Covers stay with their owners: the new book gets a generated one.
    await upsertBook(userId, {
      id: bookId,
      title: row.title,
      author: row.author,
      isbn: row.isbn ?? undefined,
      olWorkId: row.olWorkId ?? undefined,
      status: "to-read",
      rating: 0,
      colorIndex: Math.floor(Math.random() * PALETTE.length),
      addedAt: new Date().toISOString(),
    });
  }
  await getDb()
    .update(recommendation)
    .set({ state: "added", addedBookId: bookId, updatedAt: sql`now()` })
    .where(eq(recommendation.id, id));
  return bookId;
}

export async function dismissRecommendation(userId: string, id: string): Promise<void> {
  await received(userId, id);
  await getDb().update(recommendation).set({ state: "dismissed", updatedAt: sql`now()` }).where(eq(recommendation.id, id));
}

// The sender takes back one not answered yet.
export async function withdrawRecommendation(userId: string, id: string): Promise<boolean> {
  const gone = await getDb()
    .delete(recommendation)
    .where(and(eq(recommendation.id, id), eq(recommendation.fromUser, userId), inArray(recommendation.state, ["new", "seen"])))
    .returning();
  if (gone.length) {
    await getDb()
      .delete(schema.notification)
      .where(and(eq(schema.notification.kind, "recommendation"), eq(schema.notification.objectRef, id)));
  }
  return gone.length > 0;
}

type Db = ReturnType<typeof getDb> | Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

// Unfriending or blocking: recommendations still waiting between the two go,
// with their notifications. Ones already answered stay with the recipient.
export async function dropWaiting(a: string, b: string, db: Db = getDb()): Promise<void> {
  const gone = await db
    .delete(recommendation)
    .where(
      and(
        inArray(recommendation.state, ["new", "seen"]),
        or(
          and(eq(recommendation.fromUser, a), eq(recommendation.toUser, b)),
          and(eq(recommendation.fromUser, b), eq(recommendation.toUser, a))
        )
      )
    )
    .returning({ id: recommendation.id });
  if (gone.length) {
    await db.delete(schema.notification).where(
      and(
        eq(schema.notification.kind, "recommendation"),
        inArray(
          schema.notification.objectRef,
          gone.map((g) => g.id)
        )
      )
    );
  }
}

export async function countRecommendations(): Promise<number> {
  const [row] = await getDb().select({ n: sql<number>`count(*)` }).from(recommendation);
  return Number(row.n);
}
