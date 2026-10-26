import { spawnSync } from "child_process";
import { readFileSync } from "fs";
import path from "path";
import { describe, expect, inject, it } from "vitest";
import { book, reader, Visitor, type Reader } from "./client";
import { makeProfile, socialReader, uniqueHandle, userId, visitor, withDb, type Profile } from "./socialHelpers";

// Social features (lib/social/, SOCIAL=true): profiles at /u/<handle>, in
// Showcase's place. These run against the social test server, except where
// they check that a server without SOCIAL has none of it.

const YEAR = new Date().getFullYear();

// Made straight in the database, so these tests don't depend on the
// friends API (friends.test.ts tests that).
async function befriend(a: Reader, b: Reader) {
  const [x, y] = [await userId(a), await userId(b)].sort();
  await withDb((c) => c.query("INSERT INTO friendship (user_a, user_b) VALUES ($1, $2)", [x, y]));
}
async function blockReader(blocker: Reader, blocked: Reader) {
  const [x, y] = [await userId(blocker), await userId(blocked)];
  await withDb((c) => c.query("INSERT INTO block (blocker, blocked) VALUES ($1, $2)", [x, y]));
}

// A reader with a little of everything, and a profile.
async function ada(over: Partial<Profile> = {}): Promise<{ r: Reader; p: Profile }> {
  const r = await socialReader("Ada Lovelace");
  const put = (id: string, o: Record<string, unknown>) => r.json(`/api/books/${id}`, "PUT", book(id, o));
  await put("feb", { title: "February Book", status: "read", dateRead: `${YEAR}-02-10`, rating: 5, pages: 300, format: "kindle" });
  await put("tbr", { title: "Someday Book", status: "to-read", rating: 0 });
  await put("now", { title: "Current Book", status: "reading", rating: 0, pages: 400 });
  await put("gave", { title: "Abandoned Book", status: "dnf", rating: 0 });
  await r.json("/api/notes/feb", "PUT", { notes: "A private thought about February" });
  const p = await makeProfile(r, { handle: uniqueHandle("ada"), bio: "Mostly novels", ...over });
  return { r, p };
}

const page = async (v: Visitor, path: string) => {
  const res = await v.fetch(path);
  return { status: res.status, html: res.status === 200 ? await res.text() : "" };
};

describe("without SOCIAL", () => {
  it("has none of it: no profiles, no Profile tab, Showcase as before", async () => {
    const r = await reader(); // the plain server
    expect((await r.fetch("/api/profile")).status).toBe(404);
    expect((await r.json("/api/profile", "PATCH", { handle: "someone" })).status).toBe(404);
    expect((await r.fetch("/profile")).status).toBe(404);
    expect((await r.fetch("/u/someone")).status).toBe(404);
    expect((await new Visitor().fetch("/u/someone")).status).toBe(404);
    const html = await (await r.fetch("/settings")).text();
    expect(html).toContain('href="/showcase"');
    expect(html).not.toContain('href="/profile"');
    expect(html).not.toContain("Profile page");
  });
});

describe("the Profile tab", () => {
  it("takes Showcase's place", async () => {
    const r = await socialReader();
    const html = await (await r.fetch("/settings")).text();
    expect(html).toContain('href="/profile"');
    expect(html).not.toContain('href="/showcase"');
    const showcase = await r.fetch("/showcase");
    expect(showcase.status).toBe(307);
    expect(showcase.headers.get("location")).toMatch(/\/profile$/);
  });

  it("offers to make a profile, then leads to it", async () => {
    const r = await socialReader("Ada Lovelace");
    const before = await page(r, "/profile");
    expect(before.status).toBe(200);
    expect(before.html).toContain("Make your profile");
    expect(before.html).toContain('value="ada_lovelace"'); // a handle suggested from the name
    const p = await makeProfile(r, { handle: uniqueHandle("ada") });
    const after = await r.fetch("/profile");
    expect(after.status).toBe(307);
    expect(after.headers.get("location")).toMatch(new RegExp(`/u/${p.handle}$`));
  });
});

describe("making a profile", () => {
  it("needs a handle the first time, then changes any part of it", async () => {
    const r = await socialReader();
    expect((await r.get<{ profile: Profile | null }>("/api/profile")).profile).toBeNull();
    const first = await r.json("/api/profile", "PATCH", { bio: "Hello" });
    expect(first.status).toBe(400);
    expect(await first.json()).toEqual({ error: "Choose a handle." });

    const handle = uniqueHandle("Reader");
    const p = await makeProfile(r, { handle: `@${handle.toUpperCase()}` });
    expect(p).toEqual({ handle: handle.toLowerCase(), bio: null, visibility: "friends", shareReading: true, shareRatings: true });
    const changed = await makeProfile(r, { bio: "  Mostly novels ", shareRatings: false });
    expect(changed).toEqual({ ...p, bio: "Mostly novels", shareRatings: false });
    expect((await r.get<{ profile: Profile }>("/api/profile")).profile).toEqual(changed);
  });

  it("refuses a handle someone else has, however it's typed", async () => {
    const { p } = await ada();
    const other = await socialReader();
    const res = await other.json("/api/profile", "PATCH", { handle: p.handle.toUpperCase() });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "That handle is taken." });
    expect((await other.json("/api/profile", "PATCH", { handle: "admin" })).status).toBe(400);
    expect((await other.json("/api/profile", "PATCH", { handle: "no spaces" })).status).toBe(400);
  });

  it("frees the handle when the profile is removed, and the page goes", async () => {
    const { r, p } = await ada({ visibility: "public" });
    expect((await r.fetch("/api/profile", { method: "DELETE" })).status).toBe(200);
    expect((await visitor().fetch(`/u/${p.handle}`)).status).toBe(404);
    expect((await r.fetch(`/u/${p.handle}`)).status).toBe(404);
    const other = await socialReader();
    await makeProfile(other, { handle: p.handle });
  });

  it("goes with the account", async () => {
    const { r, p } = await ada({ visibility: "public" });
    expect((await r.json("/api/account", "DELETE", { password: r.password })).status).toBe(200);
    expect((await visitor().fetch(`/u/${p.handle}`)).status).toBe(404);
    expect(await withDb(async (c) => (await c.query("SELECT 1 FROM profile WHERE handle = $1", [p.handle])).rowCount)).toBe(0);
  });
});

describe("who sees a profile", () => {
  it("follows its visibility, and a hidden profile looks like no profile at all", async () => {
    const { r, p } = await ada({ visibility: "private" });
    const friend = await socialReader();
    const stranger = await socialReader();
    await befriend(r, friend);
    const path = `/u/${p.handle}`;
    const status = async () => [
      (await r.fetch(path)).status,
      (await friend.fetch(path)).status,
      (await stranger.fetch(path)).status,
      (await visitor().fetch(path)).status,
    ];

    expect(await status()).toEqual([200, 404, 404, 404]);
    await makeProfile(r, { visibility: "friends" });
    expect(await status()).toEqual([200, 200, 404, 404]);
    await makeProfile(r, { visibility: "public" });
    expect(await status()).toEqual([200, 200, 200, 200]);

    const missing = await visitor().fetch(`/u/${uniqueHandle("nobody")}`);
    const hidden = await (async () => {
      await makeProfile(r, { visibility: "private" });
      return visitor().fetch(path);
    })();
    expect([missing.status, hidden.status]).toEqual([404, 404]);
  });

  it("is never a reader blocked either way, public or not", async () => {
    const { r, p } = await ada({ visibility: "public" });
    const blocked = await socialReader();
    const blocker = await socialReader();
    await blockReader(r, blocked);
    await blockReader(blocker, r);
    expect((await blocked.fetch(`/u/${p.handle}`)).status).toBe(404);
    expect((await blocker.fetch(`/u/${p.handle}`)).status).toBe(404);
    expect((await visitor().fetch(`/u/${p.handle}`)).status).toBe(200);
  });

  it("is never indexed", async () => {
    const { p } = await ada({ visibility: "public" });
    const { html } = await page(visitor(), `/u/${p.handle}`);
    expect(html).toMatch(/<meta name="robots" content="noindex, nofollow"/);
  });
});

describe("what a profile shows", () => {
  it("shows strangers what was read; friends also what's being read and the to-read shelf", async () => {
    const { r, p } = await ada({ visibility: "public" });
    const friend = await socialReader();
    await befriend(r, friend);

    const pub = (await page(visitor(), `/u/${p.handle}`)).html;
    expect(pub).toContain("Ada Lovelace");
    expect(pub).toContain(`@${p.handle}`);
    expect(pub).toContain("Mostly novels");
    expect(pub).toContain("February Book");
    expect(pub).not.toContain("Current Book");
    expect(pub).not.toContain("to read next");

    const fr = (await page(friend, `/u/${p.handle}`)).html;
    expect(fr).toContain("February Book");
    expect(fr).toContain("Current Book");
    expect(fr).toContain("1 book to read next");
  });

  it("never shows notes, sources, books given up on or the reader's email", async () => {
    const { r, p } = await ada({ visibility: "public" });
    const friend = await socialReader();
    await befriend(r, friend);
    for (const v of [visitor(), friend, r]) {
      const { html } = await page(v, `/u/${p.handle}`);
      expect(html).not.toContain("A private thought");
      expect(html).not.toContain("Kindle");
      expect(html).not.toContain("Abandoned Book");
      if (v !== r) expect(html).not.toContain(r.email);
    }
  });

  it("leaves out what's being read, and ratings, when the reader says so", async () => {
    const { r, p } = await ada({ shareReading: false, shareRatings: false });
    const friend = await socialReader();
    await befriend(r, friend);
    const { html } = await page(friend, `/u/${p.handle}`);
    expect(html).not.toContain("Current Book");
    expect(html).not.toContain("Average rating");
    expect(html).toContain("1 book to read next"); // the to-read shelf is still counted
  });
});

// Two readers' covers can share a file name (they're named after book ids,
// which are only unique per reader), so a profile's covers have their own
// addresses that look in the right library.
const cover = (byte: number) => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(2000).fill(byte)])], { type: "image/jpeg" });

describe("profile images", () => {
  it("serves the covers of the books this viewer may see, from the profile's own library", async () => {
    const { r, p } = await ada({ visibility: "public" });
    for (const id of ["feb", "tbr"]) {
      expect((await r.upload("/api/covers", { file: cover(1), id })).status).toBe(200);
      const b = (await r.get<{ books: { id: string }[] }>("/api/books")).books.find((x) => x.id === id)!;
      await r.json(`/api/books/${id}`, "PUT", { ...b, coverImage: `/api/covers/${id}.jpg?v=1` });
    }
    // Someone else with a book of the same id and a cover of their own.
    const other = await socialReader();
    await other.json("/api/books/feb", "PUT", book("feb"));
    await other.upload("/api/covers", { file: cover(2), id: "feb" });

    const { html } = await page(other, `/u/${p.handle}`);
    expect(html).toContain(`/u/${p.handle}/covers/feb.jpg?v=1`);
    expect(html).not.toContain("/api/covers/");
    const res = await other.fetch(`/u/${p.handle}/covers/feb.jpg`);
    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())[10]).toBe(1); // Ada's, not their own
    expect(res.headers.get("cache-control")).toContain("private");

    expect((await visitor().fetch(`/u/${p.handle}/covers/feb.jpg`)).status).toBe(200);
    expect((await visitor().fetch(`/u/${p.handle}/covers/tbr.jpg`)).status).toBe(404); // friends only
    expect((await visitor().fetch(`/u/${p.handle}/covers/..%2Ffeb.jpg`)).status).toBe(404);
    const friend = await socialReader();
    await befriend(r, friend);
    expect((await friend.fetch(`/u/${p.handle}/covers/tbr.jpg`)).status).toBe(200);

    await makeProfile(r, { visibility: "private" });
    expect((await visitor().fetch(`/u/${p.handle}/covers/feb.jpg`)).status).toBe(404);
  });

  it("serves the reader's current photo to whoever may see the profile", async () => {
    const { r, p } = await ada({ visibility: "friends" });
    const up = await r.upload("/api/avatar", { file: cover(3) });
    expect(up.status).toBe(200);
    const { image } = (await up.json()) as { image: string };
    const name = image.split("/").pop();
    const friend = await socialReader();
    await befriend(r, friend);
    const { html } = await page(friend, `/u/${p.handle}`);
    expect(html).toContain(`/u/${p.handle}/avatar/${name}`);
    expect((await friend.fetch(`/u/${p.handle}/avatar/${name}`)).status).toBe(200);
    expect((await friend.fetch(`/u/${p.handle}/avatar/other.jpg`)).status).toBe(404);
    expect((await visitor().fetch(`/u/${p.handle}/avatar/${name}`)).status).toBe(404);
  });
});

describe("showcase links", () => {
  it("lead to the reader's profile once it's public", async () => {
    const { r, p } = await ada({ visibility: "friends" });
    const res = await r.json("/api/showcases", "POST", { year: YEAR, name: "Ada" });
    const { showcase } = (await res.json()) as { showcase: { id: string } };
    expect((await visitor().fetch(`/s/${showcase.id}`)).status).toBe(200); // not public yet: the showcase as it was
    await makeProfile(r, { visibility: "public" });
    const moved = await visitor().fetch(`/s/${showcase.id}`);
    expect(moved.status).toBe(307);
    expect(moved.headers.get("location")).toMatch(new RegExp(`/u/${p.handle}$`));
  });
});

describe("logs", () => {
  it("never carry handles or bios", async () => {
    const { p } = await ada({ bio: "A bio nobody should log" });
    await new Promise((r) => setTimeout(r, 300));
    const log = readFileSync(inject("socialLog"), "utf8");
    expect(log).toContain('"event":"profile.saved"');
    expect(log).not.toContain(p.handle);
    expect(log).not.toContain("A bio nobody should log");
  });
});

describe("taste", () => {
  it("shows another reader the books you've both read, and a match once there are enough ratings", async () => {
    const { r, p } = await ada({ visibility: "public" });
    const ben = await socialReader("Ben");
    const view = async () => (await page(ben, `/u/${p.handle}`)).html;

    expect(await view()).not.toContain("You’ve both read");
    // Ben read February Book too, typed in by hand.
    await ben.json("/api/books/x1", "PUT", book("x1", { title: "february book", author: "author", status: "read", rating: 4 }));
    let html = await view();
    expect(html).toContain("You’ve both read");
    expect(html).toContain("About 1 book");
    expect(html).not.toContain("Taste match");

    // Two more both rated: enough for a match.
    for (const id of ["m1", "m2"]) {
      await r.json(`/api/books/${id}`, "PUT", book(id, { title: `Shared ${id}`, status: "read", rating: 4 }));
      await ben.json(`/api/books/${id}`, "PUT", book(id, { title: `Shared ${id}`, status: "read", rating: 4 }));
    }
    html = await view();
    expect(html).toContain("Taste match");
    expect(html).toMatch(/>\d+%</);

    // Never on your own page, nor for visitors.
    expect(await (await r.fetch(`/u/${p.handle}`)).text()).not.toContain("You’ve both read");
    expect(await (await visitor().fetch(`/u/${p.handle}`)).text()).not.toContain("You’ve both read");
  });

  it("never uses ratings the reader doesn't share", async () => {
    const { r, p } = await ada({ visibility: "public", shareRatings: false });
    const ben = await socialReader("Ben");
    for (const id of ["m1", "m2", "m3"]) {
      await r.json(`/api/books/${id}`, "PUT", book(id, { title: `Shared ${id}`, status: "read", rating: 5 }));
      await ben.json(`/api/books/${id}`, "PUT", book(id, { title: `Shared ${id}`, status: "read", rating: 5 }));
    }
    const html = await (await ben.fetch(`/u/${p.handle}`)).text();
    expect(html).toContain("You’ve both read");
    expect(html).not.toContain("Taste match");
  });
});

describe("link previews", () => {
  it("have a picture for public profiles only", async () => {
    const { r, p } = await ada({ visibility: "public" });
    const html = await (await visitor().fetch(`/u/${p.handle}`)).text();
    expect(html).toMatch(new RegExp(`<meta property="og:image" content="[^"]*/u/${p.handle}/card"`));
    const img = await visitor().fetch(`/u/${p.handle}/card`);
    expect(img.status).toBe(200);
    expect(img.headers.get("content-type")).toBe("image/png");

    await makeProfile(r, { visibility: "friends" });
    expect((await visitor().fetch(`/u/${p.handle}/card`)).status).toBe(404);
    const friendsOnly = await (await r.fetch(`/u/${p.handle}`)).text();
    expect(friendsOnly).not.toContain('property="og:');
    expect(friendsOnly).not.toContain("/card");
  });
});

describe("taking a profile down", () => {
  it("can be done from the server with remove-profile, given the reported link", async () => {
    const { r, p } = await ada({ visibility: "public" });
    const run = (arg: string) =>
      spawnSync(process.execPath, [path.resolve(__dirname, "../../scripts/remove-profile.mjs"), arg], {
        env: { ...process.env, DATABASE_URL: inject("socialDbUrl") },
        encoding: "utf8",
      });
    const taken = run(`https://app.example.com/u/${p.handle}?year=2025`);
    expect(taken.status).toBe(0);
    expect(taken.stdout).toContain(`Took down ${r.email}'s profile, @${p.handle}`);
    expect((await visitor().fetch(`/u/${p.handle}`)).status).toBe(404);
    expect((await r.get<{ books: unknown[] }>("/api/books")).books).toHaveLength(4); // library untouched

    expect(run(`@${p.handle}`).status).toBe(1); // already gone
    expect(run("no spaces allowed").stderr).toContain("isn't a profile link or handle");
  });
});
