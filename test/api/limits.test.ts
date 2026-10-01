import { readFileSync } from "fs";
import path from "path";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { book, limitedBaseUrl, reader } from "./client";

// Against the "limited" test server: LIMIT_BOOKS=3, LIMIT_WORDS=2,
// LIMIT_STORAGE_MB=1, LIMIT_UPLOAD_MB=1, LIMIT_IMPORT_MB=1.

const limitedReader = () => reader("Reader", limitedBaseUrl());
const KB = 1024;
const jpegOf = (bytes: number) => {
  const data = new Uint8Array(bytes).fill(7);
  data.set([0xff, 0xd8, 0xff, 0xe0]);
  return new Blob([data], { type: "image/jpeg" });
};
const word = (id: string) => ({ id, word: `word-${id}`, definition: "a meaning" });
const errorOf = async (res: Response) => ((await res.json()) as { error: string }).error;

describe("per-account limits", () => {
  it("stops new books at the limit, but still saves changes to existing ones", async () => {
    const r = await limitedReader();
    for (const id of ["b1", "b2", "b3"]) expect((await r.json(`/api/books/${id}`, "PUT", book(id))).status).toBe(200);

    const fourth = await r.json("/api/books/b4", "PUT", book("b4"));
    expect(fourth.status).toBe(403);
    expect(await errorOf(fourth)).toContain("limit of 3 books");

    expect((await r.json("/api/books/b2", "PUT", book("b2", { title: "Renamed" }))).status).toBe(200);
    await r.json("/api/books/b1", "DELETE");
    expect((await r.json("/api/books/b4", "PUT", book("b4"))).status).toBe(200);
  });

  it("stops new words at the limit", async () => {
    const r = await limitedReader();
    expect((await r.json("/api/vocabulary/w1", "PUT", word("w1"))).status).toBe(200);
    expect((await r.json("/api/vocabulary/w2", "PUT", word("w2"))).status).toBe(200);
    expect((await r.json("/api/vocabulary/w3", "PUT", word("w3"))).status).toBe(403);
  });

  it("refuses an image over the upload limit", async () => {
    const r = await limitedReader();
    const res = await r.upload("/api/covers", { file: jpegOf(1100 * KB), id: "b1" });
    expect(res.status).toBe(413);
    expect(await errorOf(res)).toContain("1 MB limit");
  });

  it("stops images once the account's space is used up", async () => {
    const r = await limitedReader();
    expect((await r.upload("/api/covers", { file: jpegOf(600 * KB), id: "b1" })).status).toBe(200);
    const full = await r.upload("/api/notes/images", { file: jpegOf(600 * KB), bookId: "b1" });
    expect(full.status).toBe(403);
    expect(await errorOf(full)).toContain("image space");

    // Other accounts have their own space.
    const other = await limitedReader();
    expect((await other.upload("/api/covers", { file: jpegOf(600 * KB), id: "b1" })).status).toBe(200);
  });

  it("checks an import against the limits before saving any of it", async () => {
    const r = await limitedReader();
    const library = (n: number) => strToU8(JSON.stringify({ books: Array.from({ length: n }, (_, i) => book(`i${i}`)) }));

    const tooMany = await r.upload("/api/import", { file: new Blob([zipSync({ "library.json": library(5) })]) });
    expect(tooMany.status).toBe(400);
    expect(await errorOf(tooMany)).toContain("allows 3 books");
    expect((await r.get<{ books: unknown[] }>("/api/books")).books).toHaveLength(0);

    const fits = await r.upload("/api/import", { file: new Blob([zipSync({ "library.json": library(3) })]) });
    expect(fits.status).toBe(200);
  });

  it("refuses a small zip that unpacks into something huge", async () => {
    const r = await limitedReader();
    const bomb = zipSync({ "library.json": strToU8('{"books":[]}'), "covers/b1.jpg": new Uint8Array(3 * 1024 * KB) });
    expect(bomb.length).toBeLessThan(100 * KB);
    const res = await r.upload("/api/import", { file: new Blob([bomb]) });
    expect(res.status).toBe(400);
    expect(await errorOf(res)).toContain("unpacks to more");
  });

  it("warns at the preview when a Goodreads import would go over the book limit", async () => {
    const r = await limitedReader();
    const csv = new Blob([readFileSync(path.join(__dirname, "../fixtures/goodreads_library_export.csv"))], { type: "text/csv" });
    const res = await r.upload("/api/import/csv", { file: csv, mode: "preview" });
    expect(res.status).toBe(403);
    expect(await errorOf(res)).toContain("allows 3 books");
  });
});

describe("without limits", () => {
  it("lets an account grow past them", async () => {
    const r = await reader();
    for (const id of ["b1", "b2", "b3", "b4"]) expect((await r.json(`/api/books/${id}`, "PUT", book(id))).status).toBe(200);
    expect((await r.upload("/api/covers", { file: jpegOf(1100 * KB), id: "b1" })).status).toBe(200);
  });
});
