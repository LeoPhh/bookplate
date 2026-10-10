import { describe, expect, it } from "vitest";
import { averageRating, ratedReads } from "@/lib/ratings";
import type { Book } from "@/lib/types";

const book = (id: string, status: Book["status"], rating: number): Book => ({
  id,
  title: id,
  author: "A",
  status,
  rating,
  colorIndex: 0,
  addedAt: "2026-01-01T00:00:00.000Z",
});

describe("ratings", () => {
  it("average only the books read to the end", () => {
    const books = [
      book("a", "read", 5),
      book("b", "read", 3),
      book("c", "read", 0), // unrated
      book("d", "dnf", 1),
      book("e", "reading", 1),
      book("f", "to-read", 1),
    ];
    expect(averageRating(books)).toBe(4);
    expect(ratedReads(books).map((b) => b.id)).toEqual(["a", "b"]);
  });

  it("have no average without a rated read", () => {
    expect(averageRating([book("d", "dnf", 2)])).toBeNull();
  });
});
