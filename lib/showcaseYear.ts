import { summarize } from "./progress";
import { Book, ProgressEntry } from "./types";

// What a showcase page shows for one year, worked out from the library. Pure,
// so the page, its preview image and the tests all agree.

export type ShowcaseInclude = "read" | "reading" | "both";
export const INCLUDES: ShowcaseInclude[] = ["both", "read", "reading"];

// "Ada" → "Ada’s", "James" → "James’".
export const possessive = (name: string) => (name.endsWith("s") ? `${name}’` : `${name}’s`);

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface ShowcaseYear {
  year: number;
  read: Book[]; // finished that year, in the order they were finished
  months: Book[][]; // the same books, by the month they were finished (0 = January)
  reading: { book: Book; percent?: number }[]; // being read now (this year's showcase only)
  favourites: Book[]; // five-star reads
  stats: {
    books: number;
    pages: number; // of the books with a page count
    pagesPerDay?: number;
    rating?: number; // average of the rated books, one decimal
    longest?: { title: string; pages: number };
  };
}

// Books being read have no year: they belong only to the current one.
export const includesReading = (include: ShowcaseInclude, year: number, thisYear: number) =>
  include !== "read" && year === thisYear;

export const includesRead = (include: ShowcaseInclude) => include !== "reading";

const dayOfYear = (iso: string) =>
  Math.round((Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - Date.UTC(+iso.slice(0, 4), 0, 1)) / 86_400_000) + 1;

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

export function buildShowcaseYear(
  books: Book[],
  progress: ProgressEntry[],
  { year, include, today }: { year: number; include: ShowcaseInclude; today: string },
): ShowcaseYear {
  const thisYear = Number(today.slice(0, 4));
  const read = includesRead(include)
    ? books
        .filter((b) => b.status === "read" && b.dateRead?.startsWith(`${year}-`))
        .sort((a, b) => a.dateRead!.localeCompare(b.dateRead!) || a.title.localeCompare(b.title))
    : [];
  const reading = includesReading(include, year, thisYear)
    ? books
        .filter((b) => b.status === "reading")
        .map((book) => ({ book, percent: summarize(book, progress, today)?.percent }))
        .sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1) || a.book.title.localeCompare(b.book.title))
    : [];

  const months: Book[][] = MONTHS.map(() => []);
  for (const b of read) months[Number(b.dateRead!.slice(5, 7)) - 1]?.push(b);

  const paged = read.filter((b) => b.pages && b.pages > 0);
  const pages = paged.reduce((sum, b) => sum + b.pages!, 0);
  const days = year === thisYear ? dayOfYear(today) : isLeap(year) ? 366 : 365;
  const rated = read.filter((b) => b.rating > 0);
  const longest = paged.reduce<Book | undefined>((top, b) => (!top || b.pages! > top.pages! ? b : top), undefined);

  return {
    year,
    read,
    months,
    reading,
    favourites: read.filter((b) => b.rating === 5),
    stats: {
      books: read.length,
      pages,
      pagesPerDay: pages > 0 ? Math.round(pages / days) : undefined,
      rating: rated.length ? Math.round((rated.reduce((s, b) => s + b.rating, 0) / rated.length) * 10) / 10 : undefined,
      longest: longest ? { title: longest.title, pages: longest.pages! } : undefined,
    },
  };
}
