import { describe, expect, it } from "vitest";
import { isValidBook, isValidProgress, isValidVocab } from "@/lib/validate";

describe("isValidBook", () => {
  it("accepts a minimal book and rejects bad ids or types", () => {
    expect(isValidBook({ id: "b-1", title: "T", author: "A" })).toBe(true);
    expect(isValidBook({ id: "../etc", title: "T", author: "A" })).toBe(false);
    expect(isValidBook({ id: "b", title: 3, author: "A" })).toBe(false);
    expect(isValidBook({ id: "b", title: "T", author: "A", pages: "many" })).toBe(false);
    expect(isValidBook(null)).toBe(false);
  });

  it("accepts only real Open Library work ids", () => {
    expect(isValidBook({ id: "b", title: "T", author: "A", olWorkId: "OL893414W" })).toBe(true);
    expect(isValidBook({ id: "b", title: "T", author: "A", olWorkId: "not-an-id" })).toBe(false);
  });
});

describe("isValidVocab", () => {
  it("requires a word and definition, and string synonyms", () => {
    expect(isValidVocab({ id: "w", word: "sietch", definition: "a community" })).toBe(true);
    expect(isValidVocab({ id: "w", word: "x", definition: "y", synonyms: ["a", 2] })).toBe(false);
    expect(isValidVocab({ id: "w", word: "x" })).toBe(false);
  });
});

describe("isValidProgress", () => {
  const ok = { bookId: "b", date: "2026-10-01", page: 12, percent: 4 };
  it("accepts a well-formed entry", () => {
    expect(isValidProgress(ok)).toBe(true);
    expect(isValidProgress({ ...ok, page: undefined })).toBe(true);
  });
  it("rejects out-of-range or malformed values", () => {
    expect(isValidProgress({ ...ok, percent: 140 })).toBe(false);
    expect(isValidProgress({ ...ok, percent: -1 })).toBe(false);
    expect(isValidProgress({ ...ok, date: "yesterday" })).toBe(false);
    expect(isValidProgress({ ...ok, page: 1.5 })).toBe(false);
    expect(isValidProgress({ ...ok, bookId: "a/b" })).toBe(false);
  });
});
