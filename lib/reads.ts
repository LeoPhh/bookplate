import type { Book, PastRead } from "./types";

// Rereads. A book's `dateRead` is its latest finish; `pastReads` are the
// times it was read to the end before that. Statistics and profiles count
// finishes, not books: a book read twice in a year counts twice there, and
// its pages twice.

export interface Finish {
  book: Book;
  date?: string; // ISO yyyy-mm-dd, when known
  reread: boolean; // the book had been finished before
}

// Undated reads first (they came from a count, with nothing to say when),
// then the dated ones, oldest first.
export function tidyReads(reads: PastRead[]): PastRead[] {
  return reads
    .map((r) => (r.date ? { date: r.date } : {}))
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
}

// Every time the book was read to the end, oldest first: the earlier reads,
// then the current one when it's finished.
export function finishes(book: Book): Finish[] {
  const out: Finish[] = tidyReads(book.pastReads ?? []).map((r, i) => ({ book, date: r.date, reread: i > 0 }));
  if (book.status === "read") out.push({ book, date: book.dateRead, reread: out.length > 0 });
  return out;
}

export const timesRead = (book: Book) => (book.pastReads?.length ?? 0) + (book.status === "read" ? 1 : 0);

// Read to the end at least once, even if it's being read again now.
export const hasBeenRead = (book: Book) => timesRead(book) > 0;

// The date the latest earlier read ended: progress logged before then
// belongs to that read, not this one.
export function lastPastRead(book: Book): string | undefined {
  return book.pastReads?.reduce<string | undefined>((last, r) => (r.date && (!last || r.date > last) ? r.date : last), undefined);
}

// Every finish in the library with a date in that year, in the order they
// happened (same-day finishes by title).
export function finishesIn(books: Book[], year: number): Finish[] {
  return books
    .flatMap(finishes)
    .filter((f) => f.date?.startsWith(`${year}-`))
    .sort((a, b) => a.date!.localeCompare(b.date!) || a.book.title.localeCompare(b.book.title));
}

// Starting a book again: the finish moves into the earlier reads, and the
// book goes back to Reading. The rating stays; it's the reader's verdict.
export function startReread(book: Book): Book {
  return {
    ...book,
    status: "reading",
    dateRead: undefined,
    pastReads: tidyReads([...(book.pastReads ?? []), book.dateRead ? { date: book.dateRead } : {}]),
  };
}
