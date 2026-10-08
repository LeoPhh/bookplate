import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { book, jpeg, reader } from "./client";
import type { Book } from "@/lib/types";

const fixture = (name: string) =>
  new Blob([readFileSync(path.join(__dirname, "../fixtures", name))], { type: "text/csv" });

const sortById = (books: Book[]) => [...books].sort((a, b) => a.id.localeCompare(b.id));

describe("export and import", () => {
  it("round-trips a library into another account", async () => {
    const a = await reader("A");
    await a.json("/api/books/b1", "PUT", book("b1", { title: "Dune", pages: 412, coverImage: "/api/covers/b1.jpg", olWorkId: "OL893414W" }));
    await a.json("/api/books/b2", "PUT", book("b2", { status: "reading", pages: 300 }));
    await a.upload("/api/covers", { file: jpeg(), id: "b1" });
    await a.json("/api/notes/b1", "PUT", { notes: "Spice." });
    await a.json("/api/vocabulary/w1", "PUT", { id: "w1", word: "sietch", definition: "a community" });
    await a.json("/api/progress/b2", "PUT", { date: "2026-10-01", page: 30, percent: 10 });

    const zip = await (await a.fetch("/api/export")).blob();
    const b = await reader("B");
    const res = await b.upload("/api/import", { file: zip });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { summary: object }).summary).toMatchObject({ books: 2, words: 1, notes: 1, images: 1 });

    expect(sortById((await b.get<{ books: Book[] }>("/api/books")).books)).toEqual(
      sortById((await a.get<{ books: Book[] }>("/api/books")).books)
    );
    expect((await b.get<{ notes: string }>("/api/notes/b1")).notes).toBe("Spice.");
    expect((await b.get<{ progress: unknown[] }>("/api/progress")).progress).toHaveLength(1);
    expect((await b.fetch("/api/covers/b1.jpg")).status).toBe(200);
  });

  it("refuses a file that isn't a zip", async () => {
    const r = await reader();
    const res = await r.upload("/api/import", { file: new Blob(["hello"]) });
    expect(res.status).toBe(400);
  });
});

describe("Goodreads and StoryGraph import", () => {
  it("previews without saving, imports, and re-imports without duplicates", async () => {
    const r = await reader();
    const send = (name: string, mode: string) => r.upload("/api/import/csv", { file: fixture(name), mode });

    const preview = (await (await send("goodreads_library_export.csv", "preview")).json()) as { summary: Record<string, unknown> };
    expect(preview.summary).toMatchObject({ source: "goodreads", total: 6, added: 6, read: 3, reading: 1, toRead: 1, dnf: 1, notes: 2, skipped: 1 });
    expect((await r.get<{ books: Book[] }>("/api/books")).books).toHaveLength(0);

    await send("goodreads_library_export.csv", "apply");
    const again = (await (await send("goodreads_library_export.csv", "apply")).json()) as { summary: Record<string, unknown> };
    expect(again.summary).toMatchObject({ added: 0, updated: 6 });

    const books = (await r.get<{ books: Book[] }>("/api/books")).books;
    expect(books).toHaveLength(6);
    expect(books.find((b) => b.id === "gr-234225")).toMatchObject({ title: "Dune", isbn: "9780441013593", rating: 5, dateRead: "2024-03-14" });
    expect((await r.get<{ notes: string }>("/api/notes/gr-234225")).notes).toContain('The "spice must flow"');
    expect(books.find((b) => b.id === "gr-424242")?.status).toBe("dnf");

    // StoryGraph's Dune matches Goodreads' Dune by ISBN.
    const sg = (await (await send("storygraph_export.csv", "apply")).json()) as { summary: Record<string, unknown> };
    expect(sg.summary).toMatchObject({ source: "storygraph", total: 4, added: 3, updated: 1, dnf: 1 });
    const all = (await r.get<{ books: Book[] }>("/api/books")).books;
    expect(all).toHaveLength(9);
    expect(all.find((b) => b.title === "Infinite Jest")?.status).toBe("dnf");
  });

  it("matches a book added by hand on title and author, keeping its colour and genre", async () => {
    const r = await reader();
    await r.json("/api/books/mine", "PUT", book("mine", { title: "Project Hail Mary", author: "Andy Weir", status: "reading", rating: 0, colorIndex: 7, genre: "Sci-fi" }));
    await r.upload("/api/import/csv", { file: fixture("goodreads_library_export.csv"), mode: "apply" });
    const phm = (await r.get<{ books: Book[] }>("/api/books")).books.filter((b) => b.title === "Project Hail Mary");
    expect(phm).toHaveLength(1);
    expect(phm[0]).toMatchObject({ id: "mine", colorIndex: 7, genre: "Sci-fi", status: "read", rating: 4, isbn: "9780593135204" });
  });

  it("explains when a file isn't an export", async () => {
    const r = await reader();
    const res = await r.upload("/api/import/csv", { file: new Blob(["a,b\n1,2\n"], { type: "text/csv" }), mode: "preview" });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/Goodreads or StoryGraph/);
  });
});
