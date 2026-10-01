import { and, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "./db";
import { getStorage, keys } from "./storage";
import { Book, BookFormat, BookStatus, ProgressEntry, VocabEntry } from "./types";

// Every function takes the signed-in user's id and only ever touches that
// user's rows and files.

const { book, note, vocabEntry, readingProgress } = schema;

// ── Books ──────────────────────────────────────────────────────────────────

type BookRow = typeof book.$inferSelect;

function toBook(r: BookRow): Book {
  return {
    id: r.id,
    title: r.title,
    author: r.author,
    isbn: r.isbn ?? undefined,
    genre: r.genre ?? undefined,
    pages: r.pages ?? undefined,
    format: (r.format as BookFormat | null) ?? undefined,
    status: r.status as BookStatus,
    copy: r.copy ?? undefined,
    rating: r.rating,
    dateRead: r.dateRead ?? undefined,
    notes: r.shortNotes ?? undefined,
    coverImage: r.coverImage ?? undefined,
    colorIndex: r.colorIndex,
    addedAt: r.addedAt,
  };
}

function toBookRow(userId: string, b: Book): BookRow {
  return {
    userId,
    id: b.id,
    title: b.title,
    author: b.author,
    isbn: b.isbn ?? null,
    genre: b.genre ?? null,
    pages: b.pages ?? null,
    format: b.format ?? null,
    status: b.status ?? "to-read",
    copy: b.copy ?? null,
    rating: b.rating ?? 0,
    dateRead: b.dateRead ?? null,
    shortNotes: b.notes ?? null,
    coverImage: b.coverImage ?? null,
    colorIndex: b.colorIndex ?? 0,
    addedAt: b.addedAt ?? new Date().toISOString(),
  };
}

export async function listBooks(userId: string): Promise<Book[]> {
  const rows = await getDb().select().from(book).where(eq(book.userId, userId));
  return rows.map(toBook);
}

export async function getBook(userId: string, id: string): Promise<Book | null> {
  const [row] = await getDb()
    .select()
    .from(book)
    .where(and(eq(book.userId, userId), eq(book.id, id)));
  return row ? toBook(row) : null;
}

export async function upsertBook(userId: string, b: Book): Promise<void> {
  const row = toBookRow(userId, b);
  const changes: Partial<BookRow> = { ...row };
  delete changes.userId;
  delete changes.id;
  await getDb()
    .insert(book)
    .values(row)
    .onConflictDoUpdate({ target: [book.userId, book.id], set: changes });
}

// Removes the book together with its notes, pasted images, and cover.
export async function deleteBook(userId: string, id: string): Promise<void> {
  const db = getDb();
  const [row] = await db
    .delete(book)
    .where(and(eq(book.userId, userId), eq(book.id, id)))
    .returning({ coverImage: book.coverImage });
  await deleteNotes(userId, id);
  await db.delete(readingProgress).where(and(eq(readingProgress.userId, userId), eq(readingProgress.bookId, id)));
  const coverName = row?.coverImage?.match(/\/api\/covers\/([^/?]+)/)?.[1];
  if (coverName) await getStorage().delete(keys.cover(userId, coverName));
}

// ── Notes ──────────────────────────────────────────────────────────────────

export async function readNotes(userId: string, bookId: string): Promise<string | null> {
  const [row] = await getDb()
    .select({ markdown: note.markdown })
    .from(note)
    .where(and(eq(note.userId, userId), eq(note.bookId, bookId)));
  return row?.markdown ?? null;
}

export async function writeNotes(userId: string, bookId: string, markdown: string): Promise<void> {
  await getDb()
    .insert(note)
    .values({ userId, bookId, markdown, updatedAt: new Date() })
    .onConflictDoUpdate({ target: [note.userId, note.bookId], set: { markdown, updatedAt: new Date() } });
}

export async function listNotedBookIds(userId: string): Promise<string[]> {
  const rows = await getDb().select({ bookId: note.bookId }).from(note).where(eq(note.userId, userId));
  return rows.map((r) => r.bookId);
}

// Removes stored images the given markdown no longer references, so pasted-
// then-discarded images don't accumulate. Runs on every notes save.
export async function reconcileNotesImages(userId: string, bookId: string, markdown: string): Promise<void> {
  const storage = getStorage();
  const stored = await storage.list(keys.notesDir(userId, bookId));
  await Promise.all(
    stored
      .filter((key) => !markdown.includes(`/api/notes/images/${bookId}/${key.slice(key.lastIndexOf("/") + 1)}`))
      .map((key) => storage.delete(key))
  );
}

// Removes a book's notes and every image pasted into them.
export async function deleteNotes(userId: string, bookId: string): Promise<void> {
  await getDb()
    .delete(note)
    .where(and(eq(note.userId, userId), eq(note.bookId, bookId)));
  await getStorage().deletePrefix(keys.notesDir(userId, bookId));
}

// ── Reading progress ───────────────────────────────────────────────────────

export async function listProgress(userId: string): Promise<ProgressEntry[]> {
  const rows = await getDb()
    .select()
    .from(readingProgress)
    .where(eq(readingProgress.userId, userId))
    .orderBy(readingProgress.date);
  return rows.map((r) => ({ bookId: r.bookId, date: r.date, page: r.page ?? undefined, percent: r.percent }));
}

// Saves a day's progress, replacing any earlier update from the same day.
export async function upsertProgress(userId: string, entry: ProgressEntry): Promise<void> {
  const values = { page: entry.page ?? null, percent: entry.percent, updatedAt: new Date() };
  await getDb()
    .insert(readingProgress)
    .values({ userId, bookId: entry.bookId, date: entry.date, ...values })
    .onConflictDoUpdate({ target: [readingProgress.userId, readingProgress.bookId, readingProgress.date], set: values });
}

export async function deleteProgress(userId: string, bookId: string, date: string): Promise<void> {
  await getDb()
    .delete(readingProgress)
    .where(and(eq(readingProgress.userId, userId), eq(readingProgress.bookId, bookId), eq(readingProgress.date, date)));
}

// ── Vocabulary ─────────────────────────────────────────────────────────────

type VocabRow = typeof vocabEntry.$inferSelect;

function toVocab(r: VocabRow): VocabEntry {
  return {
    id: r.id,
    word: r.word,
    phonetic: r.phonetic ?? undefined,
    partOfSpeech: r.partOfSpeech ?? undefined,
    definition: r.definition,
    example: r.example ?? undefined,
    synonyms: r.synonyms ?? undefined,
    bookId: r.bookId ?? undefined,
    addedAt: r.addedAt,
  };
}

function toVocabRow(userId: string, w: VocabEntry): VocabRow {
  return {
    userId,
    id: w.id,
    word: w.word,
    phonetic: w.phonetic ?? null,
    partOfSpeech: w.partOfSpeech ?? null,
    definition: w.definition,
    example: w.example ?? null,
    synonyms: w.synonyms ?? null,
    bookId: w.bookId ?? null,
    addedAt: w.addedAt ?? new Date().toISOString(),
  };
}

export async function listVocabulary(userId: string): Promise<VocabEntry[]> {
  const rows = await getDb().select().from(vocabEntry).where(eq(vocabEntry.userId, userId));
  return rows.map(toVocab);
}

export async function upsertVocab(userId: string, w: VocabEntry): Promise<void> {
  const row = toVocabRow(userId, w);
  const changes: Partial<VocabRow> = { ...row };
  delete changes.userId;
  delete changes.id;
  await getDb()
    .insert(vocabEntry)
    .values(row)
    .onConflictDoUpdate({ target: [vocabEntry.userId, vocabEntry.id], set: changes });
}

export async function deleteVocab(userId: string, id: string): Promise<void> {
  await getDb()
    .delete(vocabEntry)
    .where(and(eq(vocabEntry.userId, userId), eq(vocabEntry.id, id)));
}

// ── Bulk (import) ──────────────────────────────────────────────────────────

// Writes a whole library in one transaction. Existing records with the same
// ids are overwritten; nothing else is removed.
export async function importRecords(
  userId: string,
  data: { books: Book[]; words: VocabEntry[]; notes: Record<string, string>; progress?: ProgressEntry[] }
): Promise<void> {
  await getDb().transaction(async (tx) => {
    for (let i = 0; i < data.books.length; i += 500) {
      const rows = data.books.slice(i, i + 500).map((b) => toBookRow(userId, b));
      await tx.delete(book).where(and(eq(book.userId, userId), inArray(book.id, rows.map((r) => r.id))));
      await tx.insert(book).values(rows);
    }
    for (let i = 0; i < data.words.length; i += 500) {
      const rows = data.words.slice(i, i + 500).map((w) => toVocabRow(userId, w));
      await tx
        .delete(vocabEntry)
        .where(and(eq(vocabEntry.userId, userId), inArray(vocabEntry.id, rows.map((r) => r.id))));
      await tx.insert(vocabEntry).values(rows);
    }
    for (const p of data.progress ?? []) {
      const values = { page: p.page ?? null, percent: p.percent, updatedAt: new Date() };
      await tx
        .insert(readingProgress)
        .values({ userId, bookId: p.bookId, date: p.date, ...values })
        .onConflictDoUpdate({ target: [readingProgress.userId, readingProgress.bookId, readingProgress.date], set: values });
    }
    for (const [bookId, markdown] of Object.entries(data.notes)) {
      await tx
        .insert(note)
        .values({ userId, bookId, markdown })
        .onConflictDoUpdate({ target: [note.userId, note.bookId], set: { markdown, updatedAt: new Date() } });
    }
  });
}
