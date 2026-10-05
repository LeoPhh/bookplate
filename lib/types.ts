export type BookStatus = "read" | "reading" | "to-read";
// The built-in places a book can come from. Kept under the `format` key for
// data compatibility; a book may also hold a source the reader typed in.
export type BookFormat = "bookstore" | "kindle" | "audiobook" | "borrowed" | "secondhand" | "gifted" | "library";

export interface Book {
  id: string;
  title: string;
  author: string;
  isbn?: string; // digits only; set by Goodreads/StoryGraph imports
  olWorkId?: string; // Open Library work id, e.g. OL893415W; set when added from the catalogue
  genre?: string;
  pages?: number;
  format?: string; // a BookFormat key, or a source the reader added
  status: BookStatus;
  copy?: boolean; // physical copy owned at home
  rating: number; // 0–5, 0 = unrated
  dateRead?: string; // ISO yyyy-mm-dd
  notes?: string;
  coverImage?: string; // /api/covers/<id>.jpg?v=…; absent = generated cover
  colorIndex: number; // index into PALETTE
  addedAt: string; // ISO timestamp
}

export const STATUS_LABELS: Record<BookStatus, string> = {
  read: "Read",
  reading: "Reading",
  "to-read": "TBR",
};

// One day's reading-progress update for a book.
export interface ProgressEntry {
  bookId: string;
  date: string; // ISO yyyy-mm-dd
  page?: number; // when the book has a page count
  percent: number; // 0–100
}

export interface VocabEntry {
  id: string;
  word: string;
  phonetic?: string; // e.g. /ˈsɒl.ɪ.tjuːd/
  partOfSpeech?: string;
  definition: string;
  example?: string;
  synonyms?: string[];
  bookId?: string; // book the word was learned from
  addedAt: string; // ISO timestamp
}

export const FORMAT_LABELS: Record<BookFormat, string> = {
  bookstore: "Book store",
  kindle: "Kindle",
  audiobook: "Audiobook",
  borrowed: "Borrowed",
  secondhand: "Second hand",
  gifted: "Gifted",
  library: "Library",
};

// What to show for a book's source: a built-in's label, or the reader's own text.
export function sourceLabel(format?: string): string | undefined {
  if (!format) return undefined;
  return (FORMAT_LABELS as Record<string, string>)[format] ?? format;
}

// A typed-in source, tidied up: typing "kindle" or "Book store" gives the
// built-in rather than a look-alike of its own.
export function normaliseSource(typed: string): string {
  const t = typed.trim();
  const lower = t.toLowerCase();
  const preset = (Object.keys(FORMAT_LABELS) as BookFormat[]).find(
    (k) => k === lower || FORMAT_LABELS[k].toLowerCase() === lower,
  );
  return preset ?? t;
}

// The reader's own sources: anything that isn't a built-in.
export const isCustomSource = (format?: string): format is string =>
  Boolean(format) && !(format! in FORMAT_LABELS);
