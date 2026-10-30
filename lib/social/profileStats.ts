import { summarize } from "../progress";
import { ratedReads } from "../ratings";
import { finishes, hasBeenRead } from "../reads";
import type { Book, ProgressEntry } from "../types";

// What a profile page shows, worked out from the books its viewer may see
// (lib/social/projection.ts). Pure, so the page and the tests agree.

export interface ProfileStats {
  totals: {
    books: number; // finishes, rereads included
    pages: number; // of those with a page count
    rating?: number; // average of the rated reads, one decimal
  };
  reading: { book: Book; percent?: number; page?: number }[];
  recent: Book[]; // the latest finishes, newest first
  last?: { book: Book; date: string }; // the latest finish of all
  best: Book[]; // the highest rated, best first
  shelves: { genre: string; books: number }[]; // biggest first, then "Other"
  fiveStars: number;
  finishedThisYear: number;
}

export const RECENT = 8;
export const BEST = 8;
const SHELVES = 6;

// How many read books each genre has: the biggest few, then the rest as Other.
// Books without a genre aren't on the bar. Spelling and case don't split one.
function countShelves(books: Book[]): ProfileStats["shelves"] {
  const counts = new Map<string, { genre: string; books: number }>();
  for (const b of books.filter(hasBeenRead)) {
    const genre = b.genre?.trim();
    if (!genre) continue;
    const entry = counts.get(genre.toLowerCase()) ?? { genre, books: 0 };
    entry.books++;
    counts.set(genre.toLowerCase(), entry);
  }
  const all = [...counts.values()].sort((a, b) => b.books - a.books || a.genre.localeCompare(b.genre));
  const rest = all.slice(SHELVES).reduce((n, g) => n + g.books, 0);
  return [...all.slice(0, SHELVES), ...(rest ? [{ genre: "Other", books: rest }] : [])];
}

export function buildProfileStats(books: Book[], progress: ProgressEntry[], { today }: { today: string }): ProfileStats {
  const all = books.flatMap(finishes);
  const rated = ratedReads(books);
  const dated = all.filter((f) => f.date).sort((a, b) => b.date!.localeCompare(a.date!) || a.book.title.localeCompare(b.book.title));
  const year = today.slice(0, 4);

  return {
    totals: {
      books: all.length,
      pages: all.reduce((s, f) => s + (f.book.pages ?? 0), 0),
      rating: rated.length ? Math.round((rated.reduce((s, b) => s + b.rating, 0) / rated.length) * 10) / 10 : undefined,
    },
    reading: books
      .filter((b) => b.status === "reading")
      .map((book) => {
        const summary = summarize(book, progress, today);
        return { book, percent: summary?.percent, page: summary?.page };
      }),
    recent: dated
      .filter((f, i, list) => list.findIndex((o) => o.book.id === f.book.id) === i)
      .slice(0, RECENT)
      .map((f) => f.book),
    last: dated[0] ? { book: dated[0].book, date: dated[0].date! } : undefined,
    best: [...rated]
      .sort((a, b) => b.rating - a.rating || (b.dateRead ?? "").localeCompare(a.dateRead ?? "") || a.title.localeCompare(b.title))
      .slice(0, BEST),
    shelves: countShelves(books),
    fiveStars: rated.filter((b) => b.rating === 5).length,
    finishedThisYear: all.filter((f) => f.date?.startsWith(year)).length,
  };
}
