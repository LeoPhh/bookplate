import { describe, expect, it } from "vitest";
import { html, jpeg, png, reader } from "./client";

describe("covers", () => {
  it("accept real JPEGs only", async () => {
    const r = await reader();
    expect((await r.upload("/api/covers", { file: jpeg(), id: "b1" })).status).toBe(200);
    expect((await r.upload("/api/covers", { file: html(), id: "b2" })).status).toBe(415);
    expect((await r.upload("/api/covers", { file: png(), id: "b3" })).status).toBe(415);
    const res = await r.fetch("/api/covers/b1.jpg");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("cache-control")).toContain("private");
  });

  it("refuse odd names and path tricks", async () => {
    const r = await reader();
    expect((await r.upload("/api/covers", { file: jpeg(), id: "../x" })).status).toBe(400);
    expect((await r.fetch("/api/covers/..%2F..%2Fetc%2Fpasswd")).status).toBe(404);
    expect((await r.fetch("/api/notes/images/..%2F..%2Fetc/passwd.jpg")).status).toBe(404);
  });
});

describe("images pasted into notes", () => {
  it("are typed by their contents and tidied up when the note no longer uses them", async () => {
    const r = await reader();
    const up = await r.upload("/api/notes/images", { file: png(), bookId: "b1" });
    const { path } = (await up.json()) as { path: string };
    expect(path).toMatch(/^\/api\/notes\/images\/b1\/[0-9a-f-]+\.png$/);
    expect((await r.upload("/api/notes/images", { file: html("image/png"), bookId: "b1" })).status).toBe(415);

    await r.json("/api/notes/b1", "PUT", { notes: `# Notes\n![](${path})` });
    expect((await r.fetch(path)).status).toBe(200);
    await r.json("/api/notes/b1", "PUT", { notes: "# Notes, image removed" });
    expect((await r.fetch(path)).status).toBe(404);
  });
});

describe("profile photo", () => {
  it("is replaced, served privately and removed", async () => {
    const r = await reader();
    const first = (await (await r.upload("/api/avatar", { file: jpeg() })).json()) as { image: string };
    const second = (await (await r.upload("/api/avatar", { file: jpeg() })).json()) as { image: string };
    expect(first.image).not.toBe(second.image);
    expect((await r.fetch(first.image)).status).toBe(404); // the old one is deleted
    expect((await r.fetch(second.image)).status).toBe(200);
    expect((await r.upload("/api/avatar", { file: png() })).status).toBe(415);
    expect((await r.json("/api/avatar", "DELETE")).status).toBe(200);
    expect((await r.fetch(second.image)).status).toBe(404);
  });
});
