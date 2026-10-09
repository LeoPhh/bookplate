import { describe, expect, it } from "vitest";
import { buildShowcaseYear } from "@/lib/showcaseYear";
import type { Book, ProgressEntry } from "@/lib/types";

const book = (id: string, over: Partial<Book>): Book => ({
  id,
  title: `Book ${id}`,
  author: "Author",
  status: "read",
  rating: 0,
  colorIndex: 0,
  addedAt: "2025-01-01T00:00:00.000Z",
  ...over,
});

const library: Book[] = [
  book("jan", { dateRead: "2025-01-20", pages: 300, rating: 5 }),
  book("mar1", { dateRead: "2025-03-02", pages: 500, rating: 4 }),
  book("mar2", { dateRead: "2025-03-01", rating: 3 }), // no page count
  book("old", { dateRead: "2024-12-31", pages: 900, rating: 5 }),
  book("undated", {}), // read, but when isn't known
  book("tbr", { status: "to-read" }),
  book("dnf", { status: "dnf", dateRead: "2025-02-01" }),
  book("now", { status: "reading", pages: 200 }),
  book("now2", { status: "reading" }),
];
const progress: ProgressEntry[] = [{ bookId: "now", date: "2025-06-01", page: 50, percent: 25 }];

describe("buildShowcaseYear", () => {
  it("shows the books finished that year, by month, with their numbers", () => {
    const y = buildShowcaseYear(library, progress, { year: 2025, include: "both", today: "2025-07-01" });
    expect(y.read.map((b) => b.id)).toEqual(["jan", "mar2", "mar1"]);
    expect(y.months[0].map((b) => b.id)).toEqual(["jan"]);
    expect(y.months[2].map((b) => b.id)).toEqual(["mar2", "mar1"]);
    expect(y.months[1]).toEqual([]);
    expect(y.favourites.map((b) => b.id)).toEqual(["jan"]);
    // 800 pages by 1 July, the year's 182nd day.
    expect(y.stats).toEqual({ books: 3, pages: 800, pagesPerDay: 4, rating: 4, longest: { title: "Book mar1", pages: 500 } });
  });

  it("adds what's being read, furthest along first, only to this year's page", () => {
    const now = buildShowcaseYear(library, progress, { year: 2025, include: "both", today: "2025-07-01" });
    expect(now.reading).toEqual([
      { book: expect.objectContaining({ id: "now" }), percent: 25 },
      { book: expect.objectContaining({ id: "now2" }), percent: undefined },
    ]);
    const past = buildShowcaseYear(library, progress, { year: 2024, include: "both", today: "2025-07-01" });
    expect(past.reading).toEqual([]);
    expect(past.read.map((b) => b.id)).toEqual(["old"]);
    // A whole past year: 900 pages over 2024's 366 days.
    expect(past.stats.pagesPerDay).toBe(2);
  });

  it("leaves out read books, or books being read, when asked to", () => {
    const reading = buildShowcaseYear(library, progress, { year: 2025, include: "reading", today: "2025-07-01" });
    expect(reading.read).toEqual([]);
    expect(reading.stats.books).toBe(0);
    expect(reading.reading).toHaveLength(2);
    const read = buildShowcaseYear(library, progress, { year: 2025, include: "read", today: "2025-07-01" });
    expect(read.reading).toEqual([]);
  });

  it("copes with a year with nothing in it", () => {
    const y = buildShowcaseYear(library, progress, { year: 2020, include: "read", today: "2025-07-01" });
    expect(y.read).toEqual([]);
    expect(y.stats).toEqual({ books: 0, pages: 0, pagesPerDay: undefined, rating: undefined, longest: undefined });
  });
});
