import { spawnSync } from "child_process";
import path from "path";
import { describe, expect, inject, it } from "vitest";
import { book, jpeg, reader, Visitor, type Reader } from "./client";

// Showcases: a public page of a year's reading at /s/<id> (lib/showcase.ts).

const YEAR = new Date().getFullYear();

interface Showcase {
  id: string;
  year: number;
  include: string;
  name: string | null;
}

async function make(r: Reader, body: Record<string, unknown>): Promise<Response> {
  return r.json("/api/showcases", "POST", body);
}

async function made(r: Reader, body: Record<string, unknown>): Promise<Showcase> {
  const res = await make(r, body);
  expect(res.status).toBe(200);
  return ((await res.json()) as { showcase: Showcase }).showcase;
}

// A reader with a little of everything: this year's reads (one five-star,
// one with notes), last year's, a TBR and one being read.
async function library(): Promise<Reader> {
  const r = await reader("Ada Lovelace");
  const put = (id: string, over: Record<string, unknown>) => r.json(`/api/books/${id}`, "PUT", book(id, over));
  await put("feb", { title: "February Book", status: "read", dateRead: `${YEAR}-02-10`, rating: 5, pages: 300 });
  await put("mar", { title: "March Book", status: "read", dateRead: `${YEAR}-03-05`, rating: 4, pages: 200 });
  await put("last", { title: "Last Year Book", status: "read", dateRead: `${YEAR - 1}-06-01`, rating: 3 });
  await put("tbr", { title: "Someday Book", status: "to-read", rating: 0 });
  await put("now", { title: "Current Book", status: "reading", rating: 0, pages: 400 });
  await r.json("/api/notes/feb", "PUT", { notes: "A private thought about February" });
  await r.json("/api/progress/now", "PUT", { date: `${YEAR}-01-02`, page: 100, percent: 25 });
  return r;
}

describe("making a showcase", () => {
  it("gives a link to a public page of the year, keeping it when changed", async () => {
    const r = await library();
    const s = await made(r, { year: YEAR, include: "both", name: "Ada" });
    expect(s).toMatchObject({ year: YEAR, include: "both", name: "Ada" });
    expect(s.id).toMatch(/^[A-Za-z0-9_-]{16}$/);

    const again = await made(r, { year: YEAR, include: "read", name: "  Ada   L. " });
    expect(again).toEqual({ id: s.id, year: YEAR, include: "read", name: "Ada L." });
    expect((await r.get<{ showcases: Showcase[] }>("/api/showcases")).showcases).toEqual([again]);
  });

  it("starts from Settings", async () => {
    const r = await reader();
    expect(await (await r.fetch("/settings")).text()).toContain("Showcase your year");
  });

  it("checks what it's given", async () => {
    const r = await reader();
    expect((await make(r, { year: YEAR + 1, include: "read" })).status).toBe(400);
    expect((await make(r, { year: "2020", include: "read" })).status).toBe(400);
    expect((await make(r, { year: YEAR, include: "everything" })).status).toBe(400);
    expect((await make(r, { year: YEAR, include: "read", name: "x".repeat(41) })).status).toBe(400);
    const reading = await make(r, { year: YEAR - 1, include: "reading" });
    expect(reading.status).toBe(400);
    expect((await reading.json()).error).toContain("this year");
    // "Both" for a past year is only what was read; control characters go.
    expect(await made(r, { year: YEAR - 1, include: "both", name: "A‮da\n" })).toMatchObject({
      include: "read",
      name: "Ada",
    });
    expect(await made(r, { year: YEAR - 2, include: "read", name: "   " })).toMatchObject({ name: null });
    expect((await new Visitor().json("/api/showcases", "POST", { year: YEAR, include: "read" })).status).toBe(401);
  });
});

describe("the public page", () => {
  it("shows the year's books to anyone, and nothing private", async () => {
    const r = await library();
    const s = await made(r, { year: YEAR, include: "both", name: "Ada" });
    const res = await new Visitor().fetch(`/s/${s.id}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("February Book");
    expect(html).toContain("March Book");
    expect(html).toContain("Current Book"); // on the nightstand
    expect(html).toContain("Ada’s Library");
    expect(html).not.toContain("Last Year Book");
    expect(html).not.toContain("Someday Book");
    expect(html).not.toContain("A private thought");
    expect(html).not.toContain(r.email);
    expect(html).toMatch(/<meta name="robots" content="noindex, nofollow"/);
    expect(html).toContain('href="/signup"'); // the invitation to join
  });

  it("shows only what was asked for", async () => {
    const r = await library();
    const s = await made(r, { year: YEAR, include: "reading", name: null });
    const html = await (await new Visitor().fetch(`/s/${s.id}`)).text();
    expect(html).toContain("Current Book");
    expect(html).not.toContain("February Book");
    const past = await made(r, { year: YEAR - 1, include: "read" });
    const pastHtml = await (await new Visitor().fetch(`/s/${past.id}`)).text();
    expect(pastHtml).toContain("Last Year Book");
    expect(pastHtml).not.toContain("Current Book");
  });

  it("serves the covers of the books it shows, and no others", async () => {
    const r = await library();
    for (const id of ["feb", "tbr"]) {
      expect((await r.upload("/api/covers", { file: jpeg(), id })).status).toBe(200);
      await r.json(`/api/books/${id}`, "PUT", {
        ...book(id, id === "feb" ? { status: "read", dateRead: `${YEAR}-02-10`, rating: 5 } : { status: "to-read" }),
        coverImage: `/api/covers/${id}.jpg?v=1`,
      });
    }
    const s = await made(r, { year: YEAR, include: "read" });
    const html = await (await new Visitor().fetch(`/s/${s.id}`)).text();
    expect(html).toContain(`/s/${s.id}/covers/feb.jpg?v=1`);
    expect(html).not.toContain("/api/covers/");

    const v = new Visitor();
    const cover = await v.fetch(`/s/${s.id}/covers/feb.jpg`);
    expect(cover.status).toBe(200);
    expect(cover.headers.get("content-type")).toBe("image/jpeg");
    expect((await v.fetch(`/s/${s.id}/covers/tbr.jpg`)).status).toBe(404); // not on the page
    expect((await v.fetch(`/s/${s.id}/covers/..%2Ffeb.jpg`)).status).toBe(404);
    expect((await v.fetch("/api/covers/feb.jpg")).status).toBe(401); // still private there
  });

  it("has a picture for link previews", async () => {
    const r = await library();
    const s = await made(r, { year: YEAR, include: "both", name: "Ada" });
    const html = await (await new Visitor().fetch(`/s/${s.id}`)).text();
    expect(html).toMatch(/<meta property="og:image" content="[^"]*\/s\/[^"]+\/opengraph-image/);
    const img = await new Visitor().fetch(`/s/${s.id}/opengraph-image`);
    expect(img.status).toBe(200);
    expect(img.headers.get("content-type")).toBe("image/png");
  });

  it("doesn't exist for a made-up address", async () => {
    expect((await new Visitor().fetch("/s/AAAAAAAAAAAAAAAA")).status).toBe(404);
    expect((await new Visitor().fetch("/s/not-an-id")).status).toBe(404);
  });
});

describe("turning a showcase off", () => {
  it("takes the page down at once, and only its owner can", async () => {
    const r = await library();
    const s = await made(r, { year: YEAR, include: "read" });
    const someone = await reader();
    expect((await someone.fetch(`/api/showcases/${s.id}`, { method: "DELETE" })).status).toBe(404);
    expect((await new Visitor().fetch(`/s/${s.id}`)).status).toBe(200);

    expect((await r.fetch(`/api/showcases/${s.id}`, { method: "DELETE" })).status).toBe(200);
    expect((await new Visitor().fetch(`/s/${s.id}`)).status).toBe(404);
    expect((await new Visitor().fetch(`/s/${s.id}/opengraph-image`)).status).toBe(404);
  });

  it("can be done from the server with remove-showcase, given the reported link", async () => {
    const r = await library();
    const s = await made(r, { year: YEAR, include: "read" });
    const run = (arg: string) =>
      spawnSync(process.execPath, [path.resolve(__dirname, "../../scripts/remove-showcase.mjs"), arg], {
        env: { ...process.env, DATABASE_URL: inject("dbUrl") },
        encoding: "utf8",
      });
    const taken = run(`https://app.example.com/s/${s.id}?utm=x`);
    expect(taken.status).toBe(0);
    expect(taken.stdout).toContain(`Took down ${r.email}'s ${YEAR} showcase`);
    expect((await new Visitor().fetch(`/s/${s.id}`)).status).toBe(404);
    expect((await r.get<{ books: unknown[] }>("/api/books")).books).toHaveLength(5); // library untouched

    expect(run(s.id).status).toBe(1); // already gone
    expect(run("nonsense").stderr).toContain("isn't a showcase link");
  });
});
