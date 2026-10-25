import { Book } from "./types";
import { finishesIn } from "./reads";

// What a showcase page shows for one year, worked out from the library: the
// books finished that year, never what's being read. Pure, so the page, its
// preview image and the tests all agree.
//
// Rereads count: a book finished again that year is on the shelf (marked as
// a reread), and twice if it was finished twice. Ratings are per book, so a
// book read twice still counts once towards the average and the best rated.

// "Ada" → "Ada’s", "James" → "James’".
export const possessive = (name: string) => (name.endsWith("s") ? `${name}’` : `${name}’s`);

// One finish: the book as it was finished then. Earlier reads are left off.
export type ShowcaseBook = Book & { reread?: boolean };

export interface ShowcaseYear {
  year: number;
  read: ShowcaseBook[]; // every finish that year, in the order they happened
  topRated: ShowcaseBook[]; // every book with the year's best rating, once each, in the same order
  topRating?: number; // that rating, when any book is rated
  stats: {
    books: number; // finishes, rereads included
    rereads: number;
    pages: number; // of the books with a page count
    pagesPerDay?: number;
    rating?: number; // average of the rated books, one decimal
    longest?: { id: string; title: string; pages: number };
  };
}

const dayOfYear = (iso: string) =>
  Math.round((Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - Date.UTC(+iso.slice(0, 4), 0, 1)) / 86_400_000) + 1;

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

export function buildShowcaseYear(books: Book[], { year, today }: { year: number; today: string }): ShowcaseYear {
  const thisYear = Number(today.slice(0, 4));
  const read: ShowcaseBook[] = finishesIn(books, year).map((f) => {
    const shown: ShowcaseBook = { ...f.book, dateRead: f.date, reread: f.reread || undefined };
    delete shown.pastReads;
    return shown;
  });
  // Each book once, at its first finish that year.
  const distinct = read.filter((b, i) => read.findIndex((o) => o.id === b.id) === i);

  const paged = read.filter((b) => b.pages && b.pages > 0);
  const pages = paged.reduce((sum, b) => sum + b.pages!, 0);
  const days = year === thisYear ? dayOfYear(today) : isLeap(year) ? 366 : 365;
  const rated = distinct.filter((b) => b.rating > 0);
  const topRating = rated.length ? Math.max(...rated.map((b) => b.rating)) : undefined;
  const longest = paged.reduce<Book | undefined>((top, b) => (!top || b.pages! > top.pages! ? b : top), undefined);

  return {
    year,
    read,
    topRated: topRating ? distinct.filter((b) => b.rating === topRating) : [],
    topRating,
    stats: {
      books: read.length,
      rereads: read.filter((b) => b.reread).length,
      pages,
      pagesPerDay: pages > 0 ? Math.round(pages / days) : undefined,
      rating: rated.length ? Math.round((rated.reduce((s, b) => s + b.rating, 0) / rated.length) * 10) / 10 : undefined,
      longest: longest ? { id: longest.id, title: longest.title, pages: longest.pages! } : undefined,
    },
  };
}
