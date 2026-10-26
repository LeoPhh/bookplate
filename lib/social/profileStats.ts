import { summarize } from "../progress";
import { ratedReads } from "../ratings";
import { finishes } from "../reads";
import { buildShowcaseYear, type ShowcaseYear } from "../showcaseYear";
import type { Book, ProgressEntry } from "../types";

// What a profile page shows, worked out from the books its viewer may see
// (lib/social/projection.ts). Pure, so the page and the tests agree.

export interface ProfileStats {
  totals: {
    books: number; // finishes, rereads included
    pages: number; // of those with a page count
    rating?: number; // average of the rated reads, one decimal
    since?: number; // the year of the first dated finish
  };
  genre?: { name: string; books: number }; // the most read, when any book has one
  author?: { name: string; books: number }; // the most read, with two books or more
  reading: { book: Book; percent?: number }[];
  recent: Book[]; // the latest finishes, newest first
  toRead: number;
  year: ShowcaseYear; // the year in books, as a showcase showed it
  years: { year: number; books: number }[]; // years with a finish, newest first; this one always
}

export const RECENT = 12;

// The most common value, ties going to the first alphabetically.
function most(values: string[]): { name: string; books: number } | undefined {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts]
    .map(([name, books]) => ({ name, books }))
    .sort((a, b) => b.books - a.books || a.name.localeCompare(b.name))[0];
}

export function buildProfileStats(
  books: Book[],
  progress: ProgressEntry[],
  { year, today }: { year: number; today: string }
): ProfileStats {
  const thisYear = Number(today.slice(0, 4));
  const all = books.flatMap(finishes);
  const read = books.filter((b) => finishes(b).length > 0);
  const rated = ratedReads(books);
  const dated = all.filter((f) => f.date).map((f) => f.date!).sort();
  const author = most(read.map((b) => b.author.trim()).filter(Boolean));

  const counts = new Map<number, number>([[thisYear, 0]]);
  for (const f of all) {
    const y = Number(f.date?.slice(0, 4));
    if (Number.isInteger(y) && y <= thisYear) counts.set(y, (counts.get(y) ?? 0) + 1);
  }

  return {
    totals: {
      books: all.length,
      pages: all.reduce((s, f) => s + (f.book.pages ?? 0), 0),
      rating: rated.length ? Math.round((rated.reduce((s, b) => s + b.rating, 0) / rated.length) * 10) / 10 : undefined,
      since: dated.length ? Number(dated[0].slice(0, 4)) : undefined,
    },
    genre: most(read.map((b) => b.genre?.trim() ?? "").filter(Boolean)),
    author: author && author.books >= 2 ? author : undefined,
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
    year: buildShowcaseYear(books, { year, today }),
    years: [...counts].map(([y, n]) => ({ year: y, books: n })).sort((a, b) => b.year - a.year),
  };
}
