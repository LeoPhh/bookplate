import { spawnSync } from "child_process";
import path from "path";
import { describe, expect, inject, it } from "vitest";
import { book, jpeg, reader, Visitor, type Reader } from "./client";

// Showcases: a public page of a year's reading at /s/<id> (lib/showcase.ts),
// one per reader, managed from the Showcase tab (app/showcase).

const YEAR = new Date().getFullYear();

interface Showcase {
  id: string;
  year: number;
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
  it("gives a link to a public page of the year, keeping it when changed, even to another year", async () => {
    const r = await library();
    expect((await r.get<{ showcase: Showcase | null }>("/api/showcases")).showcase).toBeNull();
    const s = await made(r, { year: YEAR, name: "Ada" });
    expect(s).toMatchObject({ year: YEAR, name: "Ada" });
    expect(s.id).toMatch(/^[A-Za-z0-9_-]{16}$/);

    const again = await made(r, { year: YEAR, name: "  Ada   L. " });
    expect(again).toEqual({ id: s.id, year: YEAR, name: "Ada L." });

    // One showcase per reader: another year takes over the same link.
    const moved = await made(r, { year: YEAR - 1, name: "Ada" });
    expect(moved).toEqual({ id: s.id, year: YEAR - 1, name: "Ada" });
    expect((await r.get<{ showcase: Showcase }>("/api/showcases")).showcase).toEqual(moved);
    const html = await (await new Visitor().fetch(`/s/${s.id}`)).text();
    expect(html).toContain("Last Year Book");
    expect(html).not.toContain("February Book");
  });

  it("starts from the Showcase tab, no longer from Settings", async () => {
    const r = await reader();
    const tab = await (await r.fetch("/showcase")).text();
    expect(tab).toContain("Put yours on display");
    expect(tab).toContain("/sample-covers/sapiens.jpg"); // too few books for a demo of their own: the sample shelf
    expect(await (await r.fetch("/settings")).text()).not.toContain("Showcase your year");
  });

  it("checks what it's given", async () => {
    const r = await reader();
    expect((await make(r, { year: YEAR + 1 })).status).toBe(400); // not a year still to come
    expect((await make(r, { year: "2020" })).status).toBe(400);
    expect((await make(r, { year: YEAR, name: "x".repeat(41) })).status).toBe(400);
    // Control characters go.
    expect(await made(r, { year: YEAR - 1, name: "A‮da\n" })).toMatchObject({ name: "Ada" });
    expect(await made(r, { year: YEAR - 2, name: "   " })).toMatchObject({ name: null });
    expect((await new Visitor().json("/api/showcases", "POST", { year: YEAR })).status).toBe(401);
  });
});

describe("the public page", () => {
  it("shows the year's books to anyone, and nothing private", async () => {
    const r = await library();
    const s = await made(r, { year: YEAR, name: "Ada" });
    const res = await new Visitor().fetch(`/s/${s.id}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("February Book");
    expect(html).toContain("March Book");
    expect(html).not.toContain("Current Book"); // what's being read stays private
    expect(html).toContain("Ada’s Library");
    expect(html).not.toContain("Last Year Book");
    expect(html).not.toContain("Someday Book");
    expect(html).not.toContain("A private thought");
    expect(html).not.toContain(r.email);
    expect(html).toMatch(/<meta name="robots" content="noindex, nofollow"/);
    expect(html).toContain('href="https://bookplate.eu"'); // the invitation to try Bookplate
    expect(html).toContain("Try it out");
    expect(html).not.toContain("Start your own library");
  });

  it("never shows what's being read, even when an old client asks for it", async () => {
    const r = await library();
    const s = await made(r, { year: YEAR, include: "reading", name: null });
    expect(s).not.toHaveProperty("include");
    const html = await (await new Visitor().fetch(`/s/${s.id}`)).text();
    expect(html).toContain("February Book");
    expect(html).not.toContain("Current Book");
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
    const s = await made(r, { year: YEAR });
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
    const s = await made(r, { year: YEAR, name: "Ada" });
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

describe("the Showcase tab", () => {
  it("demos the reader's own best year, once it has ten books, until they have a showcase", async () => {
    const r = await library();
    expect(await (await r.fetch("/showcase")).text()).toContain("/sample-covers/"); // two books: the sample shelf
    for (let i = 0; i < 8; i++) {
      await r.json(`/api/books/more${i}`, "PUT", book(`more${i}`, { title: `Book ${i}`, status: "read", dateRead: `${YEAR}-01-0${i + 1}`, rating: 4 }));
    }
    const html = await (await r.fetch("/showcase")).text();
    expect(html).toContain(`Your ${YEAR}, the way your friends would see it.`);
    expect(html).toContain("February Book");
    expect(html).not.toContain("A private thought");
    expect(html).not.toContain("/sample-covers/");
  });

  it("shows the showcase that's on, with its link and the year picker", async () => {
    const r = await library();
    const s = await made(r, { year: YEAR, name: "Ada" });
    const html = await (await r.fetch("/showcase")).text();
    expect(html).toContain(`Your ${YEAR} is on display`);
    expect(html).toContain(`/s/${s.id}`);
    expect(html).toContain("the 2 books you finished in");
    expect(html).toContain("Change the year or name");
    expect(html).not.toContain("Put yours on display");

    // Turned off, the pitch is back.
    await r.fetch(`/api/showcases/${s.id}`, { method: "DELETE" });
    expect(await (await r.fetch("/showcase")).text()).toContain("Put yours on display");
  });

  it("offers this year and each year with a finished book, never a later one", async () => {
    const r = await library();
    const html = await (await r.fetch("/showcase")).text();
    expect(html).toContain(`value="${YEAR}"`);
    expect(html).toContain(`value="${YEAR - 1}"`);
    expect(html).not.toContain(`value="${YEAR + 1}"`);
    expect(html).not.toContain(`value="${YEAR - 2}"`); // nothing finished then
  });
});

describe("turning a showcase off", () => {
  it("takes the page down at once, and only its owner can", async () => {
    const r = await library();
    const s = await made(r, { year: YEAR });
    const someone = await reader();
    expect((await someone.fetch(`/api/showcases/${s.id}`, { method: "DELETE" })).status).toBe(404);
    expect((await new Visitor().fetch(`/s/${s.id}`)).status).toBe(200);

    expect((await r.fetch(`/api/showcases/${s.id}`, { method: "DELETE" })).status).toBe(200);
    expect((await new Visitor().fetch(`/s/${s.id}`)).status).toBe(404);
    expect((await new Visitor().fetch(`/s/${s.id}/opengraph-image`)).status).toBe(404);
  });

  it("can be done from the server with remove-showcase, given the reported link", async () => {
    const r = await library();
    const s = await made(r, { year: YEAR });
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
