import type { Book } from "./types";

// Ratings count only for books read to the end: a rating on a book still
// being read, waiting to be read, or given up on isn't a verdict on the
// whole book, so it stays out of averages and the ratings chart.
export const ratedReads = (books: Book[]) => books.filter((b) => b.status === "read" && b.rating > 0);

// The average rating of the books read, or null when none is rated.
export function averageRating(books: Book[]): number | null {
  const rated = ratedReads(books);
  return rated.length ? rated.reduce((s, b) => s + b.rating, 0) / rated.length : null;
}
