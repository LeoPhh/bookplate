import { describe, expect, it } from "vitest";
import { finishes, finishesIn, hasBeenRead, lastPastRead, startReread, tidyReads, timesRead } from "@/lib/reads";
import { averageRating } from "@/lib/ratings";
import { summarize } from "@/lib/progress";
import type { Book } from "@/lib/types";

const book = (id: string, over: Partial<Book> = {}): Book => ({
  id,
  title: `Book ${id}`,
  author: "Author",
  status: "read",
  rating: 0,
  colorIndex: 0,
  addedAt: "2025-01-01T00:00:00.000Z",
  ...over,
});

describe("finishes", () => {
  it("lists earlier reads, then the current finish, marking all but the first as rereads", () => {
    const b = book("a", { dateRead: "2025-03-01", pastReads: [{}, { date: "2019-07-02" }] });
    expect(finishes(b).map((f) => [f.date, f.reread])).toEqual([
      [undefined, false],
      ["2019-07-02", true],
      ["2025-03-01", true],
    ]);
    expect(timesRead(b)).toBe(3);
  });

  it("counts a book being read again as read, but not its current read", () => {
    const b = book("a", { status: "reading", pastReads: [{ date: "2020-01-01" }] });
    expect(timesRead(b)).toBe(1);
    expect(hasBeenRead(b)).toBe(true);
    expect(hasBeenRead(book("b", { status: "to-read" }))).toBe(false);
  });

  it("gathers a year's finishes in order, a book finished twice appearing twice", () => {
    const books = [
      book("a", { dateRead: "2025-11-01", pastReads: [{ date: "2025-02-01" }] }),
      book("b", { dateRead: "2025-05-01" }),
      book("c", { dateRead: "2024-05-01" }),
    ];
    expect(finishesIn(books, 2025).map((f) => `${f.book.id}${f.reread ? "*" : ""}`)).toEqual(["a", "b", "a*"]);
  });
});

describe("startReread", () => {
  it("moves the finish into the earlier reads and keeps the rating", () => {
    const again = startReread(book("a", { rating: 4, dateRead: "2025-03-01", pastReads: [{ date: "2019-07-02" }] }));
    expect(again).toMatchObject({ status: "reading", rating: 4, dateRead: undefined });
    expect(again.pastReads).toEqual([{ date: "2019-07-02" }, { date: "2025-03-01" }]);
  });

  it("keeps an undated finish as an undated read", () => {
    expect(startReread(book("a")).pastReads).toEqual([{}]);
  });
});

describe("tidyReads", () => {
  it("puts undated reads first, then the rest oldest first", () => {
    expect(tidyReads([{ date: "2024-01-01" }, {}, { date: "2019-01-01" }])).toEqual([{}, { date: "2019-01-01" }, { date: "2024-01-01" }]);
  });
});

describe("rereads elsewhere", () => {
  it("keeps the rating of a book being read again in the average", () => {
    const books = [book("a", { rating: 4 }), book("b", { status: "reading", rating: 2, pastReads: [{}] })];
    expect(averageRating(books)).toBe(3);
  });

  it("tracks progress for the current read only", () => {
    const b = book("a", { status: "reading", pastReads: [{ date: "2026-03-10" }] });
    const progress = [
      { bookId: "a", date: "2026-03-01", percent: 50 },
      { bookId: "a", date: "2026-03-10", percent: 100 },
      { bookId: "a", date: "2026-09-01", percent: 10 },
    ];
    expect(lastPastRead(b)).toBe("2026-03-10");
    expect(summarize(b, progress, "2026-09-02")).toMatchObject({ percent: 10, started: "2026-09-01" });
  });
});
