import { and, count, eq, inArray } from "drizzle-orm";
import { config } from "./config";
import { getDb, schema } from "./db";
import { log } from "./log";
import { getStorage, keys } from "./storage";

// Per-account limits (LIMIT_* settings). Each check returns a message for the
// reader when the change would go over a limit, or null when it fits.

const mb = (bytes: number) => Math.round(bytes / (1024 * 1024));

// The response for a change that goes over a limit.
export function overLimit(message: string): Response {
  return Response.json({ error: message }, { status: 403 });
}

// One uploaded image or file larger than the server allows.
export function tooLarge(bytes: number, max: number, what = "That image"): Response | null {
  if (bytes <= max) return null;
  void log.info("limit.too_large", { bytes, max });
  return Response.json({ error: `${what} is larger than this server’s ${mb(max)} MB limit.` }, { status: 413 });
}

// Adding `bytes` of images would take the account past its storage limit.
export async function checkStorage(userId: string, bytes: number): Promise<string | null> {
  const max = config.limits.storageBytes;
  if (!max || bytes === 0) return null;
  const used = await getStorage().usage(keys.userDir(userId));
  if (used + bytes <= max) return null;
  void log.info("limit.reached", { user: userId, limit: "storage", used, adding: bytes, max });
  return `Your library is using its ${mb(max)} MB of image space. Delete some covers or pasted images to make room.`;
}

async function checkCount(
  userId: string,
  ids: string[],
  max: number,
  table: typeof schema.book | typeof schema.vocabEntry,
  what: string
): Promise<string | null> {
  if (!max || ids.length === 0) return null;
  const db = getDb();
  const [{ n: total }] = await db.select({ n: count() }).from(table).where(eq(table.userId, userId));
  // Ids already in the library are updates, not additions.
  let existing = 0;
  for (let i = 0; i < ids.length; i += 1000) {
    const [{ n }] = await db
      .select({ n: count() })
      .from(table)
      .where(and(eq(table.userId, userId), inArray(table.id, ids.slice(i, i + 1000))));
    existing += n;
  }
  const message = countMessage(total, new Set(ids).size - existing, max, what);
  if (message) void log.info("limit.reached", { user: userId, limit: what, total, max });
  return message;
}

function countMessage(total: number, added: number, max: number, what: string): string | null {
  if (added <= 0 || total + added <= max) return null;
  if (added === 1) return `Your library has reached this server’s limit of ${max.toLocaleString("en")} ${what}.`;
  return `This server allows ${max.toLocaleString("en")} ${what} per library, and that would make ${(total + added).toLocaleString("en")}.`;
}

// Adding `added` brand-new books would go over LIMIT_BOOKS.
export async function checkNewBooks(userId: string, added: number): Promise<string | null> {
  const max = config.limits.books;
  if (!max || added <= 0) return null;
  const [{ n }] = await getDb().select({ n: count() }).from(schema.book).where(eq(schema.book.userId, userId));
  const message = countMessage(n, added, max, "books");
  if (message) void log.info("limit.reached", { user: userId, limit: "books", total: n, adding: added, max });
  return message;
}

// Saving these books (new or existing ids) would go over LIMIT_BOOKS.
export function checkBooks(userId: string, ids: string[]): Promise<string | null> {
  return checkCount(userId, ids, config.limits.books, schema.book, "books");
}

// Saving these words would go over LIMIT_WORDS.
export function checkWords(userId: string, ids: string[]): Promise<string | null> {
  return checkCount(userId, ids, config.limits.words, schema.vocabEntry, "words");
}
