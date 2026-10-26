import { describe, expect, it } from "vitest";
import { compareTaste } from "@/lib/social/taste";
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

describe("compareTaste", () => {
  it("finds the books both have read, however each added them", () => {
    const mine = [
      book("m1", { title: "Middlemarch", author: "George Eliot" }),
      book("m2", { olWorkId: "OL1W", title: "Dune", author: "Frank Herbert" }),
      book("m3", { title: "Emma", author: "Jane Austen", status: "to-read" }), // not read
    ];
    const theirs = [
      book("t1", { title: "middlemarch", author: "george eliot" }),
      book("t2", { olWorkId: "ol1w", title: "Dune (Deluxe)", author: "F. Herbert" }),
      book("t3", { title: "Emma", author: "Jane Austen" }),
      book("t4", { title: "Persuasion", author: "Jane Austen" }),
    ];
    const t = compareTaste(mine, theirs);
    expect(t.common.map((b) => b.id)).toEqual(["t1", "t2"]);
    expect(t.rated).toBe(0);
    expect(t.match).toBeUndefined();
  });

  it("calls it a match only from a few books both rated, closer ratings matching more", () => {
    const keys = ["a", "b", "c"];
    const mine = keys.map((k) => book(`m${k}`, { title: k, rating: 5 }));
    expect(compareTaste(mine, keys.slice(0, 2).map((k) => book(`t${k}`, { title: k, rating: 5 }))).match).toBeUndefined();
    expect(compareTaste(mine, keys.map((k) => book(`t${k}`, { title: k, rating: 5 }))).match).toBe(100);
    expect(compareTaste(mine, keys.map((k) => book(`t${k}`, { title: k, rating: 0.5 }))).match).toBe(0);
    const some = compareTaste(mine, keys.map((k, i) => book(`t${k}`, { title: k, rating: [5, 4, 3][i] })));
    expect(some).toMatchObject({ rated: 3, match: 78 });
  });

  it("counts a book read twice once", () => {
    const t = compareTaste([book("m", { title: "X" })], [book("t1", { title: "X" }), book("t2", { title: "X" })]);
    expect(t.common).toHaveLength(1);
  });
});
