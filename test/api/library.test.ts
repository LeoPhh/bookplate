import { describe, expect, it } from "vitest";
import { book, jpeg, reader } from "./client";
import type { Book, VocabEntry } from "@/lib/types";

describe("books", () => {
  it("are saved one at a time and listed", async () => {
    const r = await reader();
    expect((await r.json("/api/books/b1", "PUT", book("b1", { title: "Dune", pages: 412 }))).status).toBe(200);
    expect((await r.json("/api/books/b2", "PUT", book("b2"))).status).toBe(200);
    // A second save replaces the book rather than adding another.
    expect((await r.json("/api/books/b1", "PUT", book("b1", { title: "Dune", rating: 5 }))).status).toBe(200);
    const { books } = await r.get<{ books: Book[] }>("/api/books");
    expect(books).toHaveLength(2);
    expect(books.find((b) => b.id === "b1")).toMatchObject({ title: "Dune", rating: 5 });
  });

  it("keep the Open Library work id they were added with", async () => {
    const r = await reader();
    await r.json("/api/books/b1", "PUT", book("b1", { title: "Dune", olWorkId: "OL893414W" }));
    // Editing the book (the form sends the whole book back) keeps it.
    await r.json("/api/books/b1", "PUT", book("b1", { title: "Dune", rating: 5, olWorkId: "OL893414W" }));
    expect((await r.get<{ books: Book[] }>("/api/books")).books[0]).toMatchObject({ olWorkId: "OL893414W", rating: 5 });
    expect((await r.json("/api/books/b2", "PUT", book("b2", { olWorkId: "/works/OL1W" }))).status).toBe(400);
  });

  it("refuses malformed books", async () => {
    const r = await reader();
    expect((await r.json("/api/books/b1", "PUT", book("b2"))).status).toBe(400); // id mismatch
    expect((await r.json("/api/books/b1", "PUT", { id: "b1", title: 1 })).status).toBe(400);
    expect((await r.fetch("/api/books/b1", { method: "PUT", body: "not json" })).status).toBe(400);
  });

  it("refuse a finished date in the future", async () => {
    const r = await reader();
    const year = new Date().getFullYear();
    const later = await r.json("/api/books/b1", "PUT", book("b1", { status: "read", dateRead: `${year + 1}-01-15` }));
    expect(later.status).toBe(400);
    expect(((await later.json()) as { error: string }).error).toContain("future");
    const today = new Date().toLocaleDateString("en-CA"); // yyyy-mm-dd
    expect((await r.json("/api/books/b1", "PUT", book("b1", { status: "read", dateRead: today }))).status).toBe(200);
  });

  it("keep earlier reads, tidied, and refuse malformed or future ones", async () => {
    const r = await reader();
    const year = new Date().getFullYear();
    const reads = [{ date: "2024-05-01" }, {}, { date: "2019-07-02" }];
    expect((await r.json("/api/books/b1", "PUT", book("b1", { status: "read", dateRead: "2025-01-01", pastReads: reads }))).status).toBe(200);
    const saved = (await r.get<{ books: Book[] }>("/api/books")).books[0];
    expect(saved.pastReads).toEqual([{}, { date: "2019-07-02" }, { date: "2024-05-01" }]);

    expect((await r.json("/api/books/b1", "PUT", book("b1", { pastReads: [{ date: "May 2019" }] }))).status).toBe(400);
    expect((await r.json("/api/books/b1", "PUT", book("b1", { pastReads: "twice" as never }))).status).toBe(400);
    expect((await r.json("/api/books/b1", "PUT", book("b1", { pastReads: [{ date: `${year + 1}-01-15` }] }))).status).toBe(400);

    // Saving without them clears them.
    await r.json("/api/books/b1", "PUT", book("b1", { status: "read" }));
    expect((await r.get<{ books: Book[] }>("/api/books")).books[0].pastReads).toBeUndefined();
  });

  it("are deleted with their cover, notes and progress", async () => {
    const r = await reader();
    await r.json("/api/books/b1", "PUT", book("b1", { coverImage: "/api/covers/b1.jpg", pages: 100 }));
    await r.upload("/api/covers", { file: jpeg(), id: "b1" });
    await r.json("/api/notes/b1", "PUT", { notes: "hello" });
    await r.json("/api/progress/b1", "PUT", { date: "2026-10-01", page: 10, percent: 10 });
    expect((await r.json("/api/books/b1", "DELETE")).status).toBe(200);
    expect((await r.fetch("/api/covers/b1.jpg")).status).toBe(404);
    expect((await r.get<{ notes: string | null }>("/api/notes/b1")).notes).toBeNull();
    expect((await r.get<{ progress: unknown[] }>("/api/progress")).progress).toHaveLength(0);
  });
});

describe("one reader's library is invisible to another", () => {
  it("books, notes, covers, words and progress", async () => {
    const a = await reader("A");
    const b = await reader("B");
    await a.json("/api/books/shared-id", "PUT", book("shared-id", { title: "A's book", pages: 50 }));
    await a.upload("/api/covers", { file: jpeg(), id: "shared-id" });
    await a.json("/api/notes/shared-id", "PUT", { notes: "A's secret notes" });
    await a.json("/api/vocabulary/w1", "PUT", { id: "w1", word: "sietch", definition: "a community" });
    await a.json("/api/progress/shared-id", "PUT", { date: "2026-10-01", page: 5, percent: 10 });

    expect((await b.get<{ books: Book[] }>("/api/books")).books).toHaveLength(0);
    expect((await b.get<{ notes: string | null }>("/api/notes/shared-id")).notes).toBeNull();
    expect((await b.get<{ words: VocabEntry[] }>("/api/vocabulary")).words).toHaveLength(0);
    expect((await b.get<{ progress: unknown[] }>("/api/progress")).progress).toHaveLength(0);
    expect((await b.fetch("/api/covers/shared-id.jpg")).status).toBe(404);

    // B using the same id only ever touches B's own data.
    await b.json("/api/books/shared-id", "PUT", book("shared-id", { title: "B's book" }));
    await b.json("/api/books/shared-id", "DELETE");
    const aBooks = (await a.get<{ books: Book[] }>("/api/books")).books;
    expect(aBooks.map((x) => x.title)).toEqual(["A's book"]);
    expect((await a.fetch("/api/covers/shared-id.jpg")).status).toBe(200);
    expect((await a.get<{ notes: string }>("/api/notes/shared-id")).notes).toBe("A's secret notes");
  });
});

describe("vocabulary", () => {
  it("adds, validates and removes words", async () => {
    const r = await reader();
    expect((await r.json("/api/vocabulary/w1", "PUT", { id: "w1", word: "sietch", definition: "a community" })).status).toBe(200);
    expect((await r.json("/api/vocabulary/w2", "PUT", { id: "w2", word: "x" })).status).toBe(400);
    expect((await r.get<{ words: VocabEntry[] }>("/api/vocabulary")).words.map((w) => w.word)).toEqual(["sietch"]);
    await r.json("/api/vocabulary/w1", "DELETE");
    expect((await r.get<{ words: VocabEntry[] }>("/api/vocabulary")).words).toHaveLength(0);
  });
});
