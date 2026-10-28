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

  it("leads straight to the reader's own profile", async () => {
    const r = await socialReader("Ada Lovelace");
    const { profile } = await r.get<{ profile: Profile }>("/api/profile");
    const res = await r.fetch("/profile");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(new RegExp(`/u/${profile.handle}$`));
    const own = await page(r, `/u/${profile.handle}`);
    expect(own.html).toContain("Share");
    expect(own.html).toContain("Edit profile");
    expect(own.html).not.toContain("Anyone with the link can see this page");
  });
});

describe("every reader's profile", () => {
  it("is made with the account, under a username from their name, the next free one if it's taken", async () => {
    const one = await socialReader("Ada Lovelace");
    const two = await socialReader("Ada Lovelace");
    // Made at sign-up: in the database before anything asks for it.
    const handles = await withDb(async (c) =>
      Promise.all(
        [one, two].map(async (r) => (await c.query('SELECT p.handle FROM profile p JOIN "user" u ON u.id = p.user_id WHERE u.email = $1', [r.email])).rows[0]?.handle)
      )
    );
    for (const h of handles) expect(h).toMatch(/^ada_lovelace\d*$/);
    expect(handles[0]).not.toBe(handles[1]);
    expect((await one.get<{ profile: Profile }>("/api/profile")).profile).toEqual({
      handle: handles[0],
      bio: null,
      visibility: "friends",
      shareReading: true,
      shareRatings: true,
    });
  });

  it("is made for accounts that had none, when they open Profile", async () => {
    const r = await socialReader("Grace Hopper");
    await withDb(async (c) => c.query('DELETE FROM profile p USING "user" u WHERE u.id = p.user_id AND u.email = $1', [r.email]));
    const res = await r.fetch("/profile");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/u\/grace_hopper\d*$/);
  });

  it("changes any part of it", async () => {
    const r = await socialReader();
    const handle = uniqueHandle("Reader");
    const p = await makeProfile(r, { handle: `@${handle.toUpperCase()}` });
    expect(p).toEqual({ handle: handle.toLowerCase(), bio: null, visibility: "friends", shareReading: true, shareRatings: true });
    const changed = await makeProfile(r, { bio: "  Mostly novels ", shareRatings: false });
    expect(changed).toEqual({ ...p, bio: "Mostly novels", shareRatings: false });
    expect((await r.get<{ profile: Profile }>("/api/profile")).profile).toEqual(changed);
  });

  it("refuses a username someone else has, however it's typed", async () => {
    const { p } = await ada();
    const other = await socialReader();
    const res = await other.json("/api/profile", "PATCH", { handle: p.handle.toUpperCase() });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "That username is taken." });
    expect((await other.json("/api/profile", "PATCH", { handle: "admin" })).status).toBe(400);
    expect((await other.json("/api/profile", "PATCH", { handle: "no spaces" })).status).toBe(400);
  });

  it("frees a username once it's changed", async () => {
    const { r, p } = await ada({ visibility: "public" });
    await makeProfile(r, { handle: uniqueHandle("renamed") });
    expect((await visitor().fetch(`/u/${p.handle}`)).status).toBe(404);
    await makeProfile(await socialReader(), { handle: p.handle });
  });

  it("goes with the account", async () => {
    const { r, p } = await ada({ visibility: "public" });
    expect((await r.json("/api/account", "DELETE", { password: r.password })).status).toBe(200);
    expect((await visitor().fetch(`/u/${p.handle}`)).status).toBe(404);
    expect(await withDb(async (c) => (await c.query("SELECT 1 FROM profile WHERE handle = $1", [p.handle])).rowCount)).toBe(0);
  });
});

describe("who sees a profile", () => {
  it("is everyone; the reading on it follows its visibility", async () => {
    const { r, p } = await ada({ visibility: "private" });
    const friend = await socialReader();
    const stranger = await socialReader();
    await befriend(r, friend);
    const path = `/u/${p.handle}`;
    // Whether each sees the books: the reader, a friend, another reader, a visitor.
    const seen = async () =>
      Promise.all(
        [r, friend, stranger, visitor()].map(async (v) => {
          const { status, html } = await page(v, path);
          expect(status).toBe(200);
          expect(html).toContain("Ada Lovelace");
          expect(html).toContain("Mostly novels");
          return html.includes("February Book");
        })
      );

    expect(await seen()).toEqual([true, false, false, false]);
    expect((await page(friend, path)).html).toContain("keeps their books and numbers private");
    await makeProfile(r, { visibility: "friends" });
    expect(await seen()).toEqual([true, true, false, false]);
    expect((await page(stranger, path)).html).toContain("shares their books and numbers with friends only");
    await makeProfile(r, { visibility: "public" });
    expect(await seen()).toEqual([true, true, true, true]);

    expect((await visitor().fetch(`/u/${uniqueHandle("nobody")}`)).status).toBe(404);
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

  it("serves the reader's current photo to anyone", async () => {
    const { r, p } = await ada({ visibility: "private" });
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
    expect((await visitor().fetch(`/u/${p.handle}/avatar/${name}`)).status).toBe(200);
  });
});

describe("showcase links", () => {
  it("lead to the reader's profile once its reading is public", async () => {
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
  it("have a picture only for profiles whose reading is public", async () => {
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
    expect(run("no spaces allowed").stderr).toContain("isn't a profile link or username");

    // The reader gets a fresh profile: no bio, friends only.
    const fresh = (await r.get<{ profile: Profile }>("/api/profile")).profile;
    expect(fresh).toMatchObject({ bio: null, visibility: "friends" });
  });
});
