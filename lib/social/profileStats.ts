import { summarize } from "../progress";
import { ratedReads } from "../ratings";
import { finishes } from "../reads";
import type { Book, ProgressEntry } from "../types";

// What a profile page shows, worked out from the books its viewer may see
// (lib/social/projection.ts). Pure, so the page and the tests agree.

export interface ProfileStats {
  totals: {
    books: number; // finishes, rereads included
    pages: number; // of those with a page count
    rating?: number; // average of the rated reads, one decimal
  };
  reading: { book: Book; percent?: number }[];
  recent: Book[]; // the latest finishes, newest first
  toRead: number;
}

export const RECENT = 12;

export function buildProfileStats(books: Book[], progress: ProgressEntry[], { today }: { today: string }): ProfileStats {
  const all = books.flatMap(finishes);
  const rated = ratedReads(books);

  return {
    totals: {
      books: all.length,
      pages: all.reduce((s, f) => s + (f.book.pages ?? 0), 0),
      rating: rated.length ? Math.round((rated.reduce((s, b) => s + b.rating, 0) / rated.length) * 10) / 10 : undefined,
    },
    reading: books
      .filter((b) => b.status === "reading")
      .map((book) => ({ book, percent: summarize(book, progress, today)?.percent })),
    recent: all
      .filter((f) => f.date)
      .sort((a, b) => b.date!.localeCompare(a.date!) || a.book.title.localeCompare(b.book.title))
      .filter((f, i, list) => list.findIndex((o) => o.book.id === f.book.id) === i)
      .slice(0, RECENT)
      .map((f) => f.book),
    toRead: books.filter((b) => b.status === "to-read").length,
  };
}
