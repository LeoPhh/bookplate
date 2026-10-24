import { describe, expect, it } from "vitest";
import { buildShowcaseYear } from "@/lib/showcaseYear";
import type { Book } from "@/lib/types";

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

describe("buildShowcaseYear", () => {
  it("shows the books finished that year, in order, with their numbers", () => {
    const y = buildShowcaseYear(library, { year: 2025, today: "2025-07-01" });
    expect(y.read.map((b) => b.id)).toEqual(["jan", "mar2", "mar1"]);
    expect(y.topRated.map((b) => b.id)).toEqual(["jan"]);
    expect(y.topRating).toBe(5);
    // 800 pages by 1 July, the year's 182nd day.
    expect(y.stats).toEqual({
      books: 3,
      pages: 800,
      pagesPerDay: 4,
      rating: 4,
      longest: { id: "mar1", title: "Book mar1", pages: 500 },
    });
  });

  it("picks out every book with the year's best rating, five stars or not", () => {
    const fours = [
      book("a", { dateRead: "2023-02-01", rating: 4 }),
      book("b", { dateRead: "2023-03-01", rating: 3 }),
      book("c", { dateRead: "2023-05-01", rating: 4 }),
      book("d", { dateRead: "2023-06-01" }), // unrated
    ];
    const y = buildShowcaseYear(fours, { year: 2023, today: "2025-07-01" });
    expect(y.topRated.map((b) => b.id)).toEqual(["a", "c"]);
    expect(y.topRating).toBe(4);
    const unrated = buildShowcaseYear([book("d", { dateRead: "2023-06-01" })], { year: 2023, today: "2025-07-01" });
    expect(unrated.topRated).toEqual([]);
    expect(unrated.topRating).toBeUndefined();
  });

  it("shows a past year whole", () => {
    const past = buildShowcaseYear(library, { year: 2024, today: "2025-07-01" });
    expect(past.read.map((b) => b.id)).toEqual(["old"]);
    // A whole past year: 900 pages over 2024's 366 days.
    expect(past.stats.pagesPerDay).toBe(2);
  });

  it("never shows what's being read", () => {
    const y = buildShowcaseYear(library, { year: 2025, today: "2025-07-01" });
    const ids = [...y.read, ...y.topRated].map((b) => b.id);
    expect(ids).not.toContain("now");
    expect(ids).not.toContain("now2");
  });

  it("copes with a year with nothing in it", () => {
    const y = buildShowcaseYear(library, { year: 2020, today: "2025-07-01" });
    expect(y.read).toEqual([]);
    expect(y.stats).toEqual({ books: 0, pages: 0, pagesPerDay: undefined, rating: undefined, longest: undefined });
  });
});
