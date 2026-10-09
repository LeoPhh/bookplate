import { randomBytes } from "crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "./db";
import { listBooks, listProgress } from "./library";
import { todayIso } from "./progress";
import { buildShowcaseYear, includesReading, INCLUDES, type ShowcaseInclude, type ShowcaseYear } from "./showcaseYear";
import { Book } from "./types";

// Showcases: a reader's public page for one year of reading, at /s/<id>. One
// per account and year; saving the same year again keeps its address. Only
// the reader's choices are stored, so the page always shows the library as it
// is now. Turning one off deletes it, and the address stops working at once.

export interface Showcase {
  id: string;
  year: number;
  include: ShowcaseInclude;
  name: string | null;
}

export const NAME_MAX = 40;
export const FIRST_YEAR = 1900;

const { showcase } = schema;

// 16 characters of base64url: 96 random bits, so addresses can't be guessed.
const newId = () => randomBytes(12).toString("base64url");
export const isShowcaseId = (id: string) => /^[A-Za-z0-9_-]{16}$/.test(id);

const toShowcase = (r: typeof showcase.$inferSelect): Showcase => ({
  id: r.id,
  year: r.year,
  include: r.include as ShowcaseInclude,
  name: r.name,
});

export class ShowcaseError extends Error {}

// Checks what the Showcase dialog sends. Returns the cleaned settings, or
// throws a ShowcaseError with a message for the reader.
export function parseShowcase(body: unknown, thisYear: number): Omit<Showcase, "id"> {
  const o = (body ?? {}) as Record<string, unknown>;
  const year = o.year;
  if (typeof year !== "number" || !Number.isInteger(year) || year < FIRST_YEAR || year > thisYear) {
    throw new ShowcaseError("Choose a year up to this one.");
  }
  const include = o.include;
  if (typeof include !== "string" || !INCLUDES.includes(include as ShowcaseInclude)) {
    throw new ShowcaseError("Choose which books to show.");
  }
  if (include === "reading" && !includesReading(include, year, thisYear)) {
    throw new ShowcaseError("Books you're reading can only go in this year's showcase.");
  }
  if (o.name !== undefined && o.name !== null && typeof o.name !== "string") throw new ShowcaseError("Invalid name.");
  // Plain text on one line: control characters (line breaks, direction
  // overrides…) go, and runs of spaces become one.
  const name = (o.name ?? "")
    .toString()
    .replace(/[\p{Cc}\p{Cf}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  if ([...name].length > NAME_MAX) throw new ShowcaseError(`Keep the name to ${NAME_MAX} characters.`);
  return {
    year,
    // "Both" for a past year is just "read": there's nothing being read then.
    include: include === "both" && year !== thisYear ? "read" : (include as ShowcaseInclude),
    name: name || null,
  };
}

export async function listShowcases(userId: string): Promise<Showcase[]> {
  const rows = await getDb().select().from(showcase).where(eq(showcase.userId, userId)).orderBy(asc(showcase.year));
  return rows.map(toShowcase);
}

// Creates the year's showcase, or changes it and keeps its address.
export async function saveShowcase(userId: string, s: Omit<Showcase, "id">): Promise<Showcase> {
  const [row] = await getDb()
    .insert(showcase)
    .values({ id: newId(), userId, year: s.year, include: s.include, name: s.name })
    .onConflictDoUpdate({
      target: [showcase.userId, showcase.year],
      set: { include: s.include, name: s.name, updatedAt: sql`now()` },
    })
    .returning();
  return toShowcase(row);
}

export async function deleteShowcase(userId: string, id: string): Promise<boolean> {
  const gone = await getDb()
    .delete(showcase)
    .where(and(eq(showcase.userId, userId), eq(showcase.id, id)))
    .returning({ id: showcase.id });
  return gone.length > 0;
}

// Everything a showcase page needs, or null when there's no such showcase.
// Cover addresses point at the showcase's own cover route, which anyone with
// the link may load (app/s/[id]/covers).
export async function loadShowcase(id: string): Promise<{ showcase: Showcase; userId: string; view: ShowcaseYear } | null> {
  if (!isShowcaseId(id)) return null;
  const [row] = await getDb().select().from(showcase).where(eq(showcase.id, id));
  if (!row) return null;
  const s = toShowcase(row);
  const [books, progress] = await Promise.all([listBooks(row.userId), listProgress(row.userId)]);
  const view = buildShowcaseYear(books.map((b) => publicBook(b, id)), progress, {
    year: s.year,
    include: s.include,
    today: todayIso(),
  });
  return { showcase: s, userId: row.userId, view };
}

// Only what a showcase shows: never notes, sources or ownership.
function publicBook(b: Book, showcaseId: string): Book {
  return {
    id: b.id,
    title: b.title,
    author: b.author,
    genre: b.genre,
    pages: b.pages,
    status: b.status,
    rating: b.rating,
    dateRead: b.dateRead,
    colorIndex: b.colorIndex,
    addedAt: b.addedAt,
    coverImage: b.coverImage ? showcaseCover(showcaseId, b.coverImage) : undefined,
  };
}

// "/api/covers/<file>?v=…" → "/s/<id>/covers/<file>?v=…"
const COVER = /^\/api\/covers\/([^/?]+)(\?.*)?$/;
export function showcaseCover(showcaseId: string, coverImage: string): string | undefined {
  const m = coverImage.match(COVER);
  return m ? `/s/${showcaseId}/covers/${m[1]}${m[2] ?? ""}` : undefined;
}

// The stored cover file a showcase may serve: one belonging to a book it shows.
export function coverFileOf(view: ShowcaseYear, file: string): boolean {
  const shown = [...view.read, ...view.reading.map((r) => r.book)];
  return shown.some((b) => b.coverImage?.split("?")[0].endsWith(`/covers/${file}`));
}

export async function countShowcases(): Promise<number> {
  const [row] = await getDb().select({ n: sql<number>`count(*)` }).from(showcase);
  return Number(row.n);
}
