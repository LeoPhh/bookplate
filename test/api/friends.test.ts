import { readFileSync } from "fs";
import { describe, expect, inject, it } from "vitest";
import { reader, type Reader } from "./client";
import { visitor, withDb, withProfile } from "./socialHelpers";

// Friends (lib/social/friends.ts, notifications.ts): requests by username,
// blocking, friends lists under each profile, and the news on the reader's
// own one. On the social test server (SOCIAL=true).

interface Someone {
  id: string;
  name: string;
  handle: string | null;
}
interface Friends {
  friends: Someone[];
  requests: { incoming: Someone[]; outgoing: Someone[] };
}
interface News {
  notifications: { kind: string; actor: Someone | null; read: boolean }[];
  unread: number;
}

const friendsOf = (r: Reader) => r.get<Friends>("/api/friends");
// Whether a reader sees the books on someone's profile (the profile itself
// opens for anyone).
const seesReading = async (r: Reader, handle: string) =>
  !(await (await r.fetch(`/u/${handle}`)).text()).includes("books and numbers");
const ids = (list: Someone[]) => list.map((p) => p.id);
const news = (r: Reader) => r.get<News>("/api/notifications");

async function ask(r: Reader, handle: string): Promise<Response> {
  return r.json("/api/friends/requests", "POST", { handle });
}

// Friends straight away: one asks, the other asks back.
async function befriend(a: { r: Reader; p: { handle: string } }, b: { r: Reader; p: { handle: string } }) {
  await ask(a.r, b.p.handle);
  await ask(b.r, a.p.handle);
}

describe("without SOCIAL", () => {
  it("has no friends, blocks or notifications", async () => {
    const r = await reader(); // the plain server
    for (const [path, method] of [
      ["/api/friends", "GET"],
      ["/api/friends/requests", "POST"],
      ["/api/blocks/someone", "PUT"],
      ["/api/notifications", "GET"],
      ["/friends", "GET"],
      ["/u/someone/friends", "GET"],
    ]) {
      expect((await r.json(path, method, method === "GET" ? undefined : {})).status, path).toBe(404);
    }
    expect(await (await r.fetch("/settings")).text()).not.toContain('href="/friends"');
  });
});

describe("friend requests", () => {
  it("are sent by handle, answered, and make both readers friends", async () => {
    const ada = await withProfile("Ada");
    const ben = await withProfile("Ben", { visibility: "friends" });

    expect(await (await ask(ada.r, `@${ben.p.handle.toUpperCase()}`)).json()).toEqual({ result: "sent" });
    expect(ids((await friendsOf(ada.r)).requests.outgoing)).toEqual([ben.id]);
    const incoming = (await friendsOf(ben.r)).requests.incoming;
    expect(incoming).toMatchObject([{ id: ada.id, name: "Ada", handle: ada.p.handle }]);
    expect(await news(ben.r)).toMatchObject({ unread: 1, notifications: [{ kind: "friend_request", actor: { id: ada.id } }] });
    // Not friends yet: Ben's reading is for friends.
    expect(await seesReading(ada.r, ben.p.handle)).toBe(false);

    expect((await ben.r.json(`/api/friends/requests/${ada.id}`, "POST", { accept: true })).status).toBe(200);
    expect(ids((await friendsOf(ada.r)).friends)).toEqual([ben.id]);
    expect(ids((await friendsOf(ben.r)).friends)).toEqual([ada.id]);
    expect((await friendsOf(ada.r)).requests).toEqual({ incoming: [], outgoing: [] });
    expect(await seesReading(ada.r, ben.p.handle)).toBe(true);
    // The request is no longer news for Ben; Ada hears it was accepted.
    expect((await news(ben.r)).notifications).toEqual([]);
    expect(await news(ada.r)).toMatchObject({ unread: 1, notifications: [{ kind: "friend_accepted", actor: { id: ben.id } }] });

    expect(await (await ask(ada.r, ben.p.handle)).json()).toEqual({ result: "already" });
  });

  it("asked both ways make friends straight away", async () => {
    const ada = await withProfile("Ada");
    const ben = await withProfile("Ben");
    await ask(ada.r, ben.p.handle);
    expect(await (await ask(ben.r, ada.p.handle)).json()).toEqual({ result: "friends" });
    expect(ids((await friendsOf(ada.r)).friends)).toEqual([ben.id]);
  });

  it("can be declined, quietly, or taken back", async () => {
    const ada = await withProfile("Ada");
    const ben = await withProfile("Ben");
    await ask(ada.r, ben.p.handle);
    expect((await ben.r.json(`/api/friends/requests/${ada.id}`, "POST", { accept: false })).status).toBe(200);
    expect((await friendsOf(ada.r)).friends).toEqual([]);
    expect((await friendsOf(ada.r)).requests.outgoing).toEqual([]);
    expect((await news(ada.r)).notifications).toEqual([]); // nothing tells Ada
    expect((await news(ben.r)).notifications).toEqual([]);

    await ask(ada.r, ben.p.handle);
    expect((await ada.r.fetch(`/api/friends/requests/${ben.id}`, { method: "DELETE" })).status).toBe(200);
    expect((await friendsOf(ben.r)).requests.incoming).toEqual([]);
    expect((await news(ben.r)).unread).toBe(0);
    expect((await ben.r.json(`/api/friends/requests/${ada.id}`, "POST", { accept: true })).status).toBe(404);
  });

  it("give nothing away about who can't be asked", async () => {
    const ada = await withProfile("Ada");
    const blocker = await withProfile("Blocker");
    await blocker.r.fetch(`/api/blocks/${ada.id}`, { method: "PUT" });
    const answers = await Promise.all(
      [blocker.p.handle, "nobody_has_this"].map(async (h) => {
        const res = await ask(ada.r, h);
        return [res.status, await res.json()];
      })
    );
    for (const a of answers) expect(a).toEqual([404, { error: "Nobody has that username." }]);
    expect((await ask(ada.r, ada.p.handle)).status).toBe(400);
  });

  it("can be sent to a reader whose reading is private", async () => {
    const ada = await withProfile("Ada");
    const shy = await withProfile("Shy", { visibility: "private" });
    expect(await (await ask(ada.r, shy.p.handle)).json()).toEqual({ result: "sent" });
  });

  it("are limited to a few dozen a day", async () => {
    const ada = await withProfile("Ada");
    const ben = await withProfile("Ben");
    await withDb((c) =>
      c.query("INSERT INTO auth_throttle (key, failures, window_start) VALUES ($1, 20, localtimestamp)", [`friend-request:${ada.id}`])
    );
    const res = await ask(ada.r, ben.p.handle);
    expect(res.status).toBe(429);
    expect((await friendsOf(ben.r)).requests.incoming).toEqual([]);
  });

  it("end with unfriending, on both sides", async () => {
    const ada = await withProfile("Ada");
    const ben = await withProfile("Ben");
    await ask(ada.r, ben.p.handle);
    await ask(ben.r, ada.p.handle);
    expect((await ben.r.fetch(`/api/friends/${ada.id}`, { method: "DELETE" })).status).toBe(200);
    expect((await friendsOf(ada.r)).friends).toEqual([]);
    expect(await seesReading(ada.r, ben.p.handle)).toBe(false);
    expect((await ben.r.fetch(`/api/friends/${ada.id}`, { method: "DELETE" })).status).toBe(404);
  });
});

describe("blocking", () => {
  it("ends the friendship and any request, hides each from the other, and can be undone", async () => {
    const ada = await withProfile("Ada", { visibility: "public" });
    const ben = await withProfile("Ben", { visibility: "public" });
    await ask(ada.r, ben.p.handle);
    await ask(ben.r, ada.p.handle);
    await ask(ada.r, ben.p.handle); // nothing new: already friends

    expect((await ada.r.fetch(`/api/blocks/${ben.id}`, { method: "PUT" })).status).toBe(200);
    expect((await friendsOf(ada.r)).friends).toEqual([]);
    expect((await friendsOf(ben.r)).friends).toEqual([]);
    expect((await news(ada.r)).notifications).toEqual([]); // nothing from Ben stays
    expect((await ben.r.fetch(`/u/${ada.p.handle}`)).status).toBe(404);
    expect((await ada.r.fetch(`/u/${ben.p.handle}`)).status).toBe(404);
    expect((await ask(ben.r, ada.p.handle)).status).toBe(404);
    expect((await ada.r.get<{ blocked: Someone[] }>("/api/blocks")).blocked).toMatchObject([{ id: ben.id, name: "Ben" }]);

    expect((await ada.r.fetch(`/api/blocks/${ben.id}`, { method: "DELETE" })).status).toBe(200);
    expect((await ben.r.fetch(`/u/${ada.p.handle}`)).status).toBe(200);
    expect((await ada.r.fetch(`/api/blocks/${ben.id}`, { method: "DELETE" })).status).toBe(404);
  });

  it("needs a real reader other than yourself", async () => {
    const ada = await withProfile("Ada");
    expect((await ada.r.fetch(`/api/blocks/${ada.id}`, { method: "PUT" })).status).toBe(400);
    expect((await ada.r.fetch("/api/blocks/nobody", { method: "PUT" })).status).toBe(404);
  });
});

describe("friends", () => {
  it("are under the profile, not a tab of their own; the Profile tab badges what's new, and opening them reads it", async () => {
    const ada = await withProfile("Ada");
    const ben = await withProfile("Ben");
    await ask(ben.r, ada.p.handle);

    const library = await (await ada.r.fetch("/")).text();
    expect(library).not.toContain('href="/friends"');
    expect(library).toMatch(/href="\/profile"[^>]*>Profile<span class="appbar-badge"[^>]*>1</);

    const profile = await (await ada.r.fetch(`/u/${ada.p.handle}`)).text();
    expect(profile).toContain(`href="/u/${ada.p.handle}/friends"`);
    expect(profile).toContain("1 new");

    const own = await (await ada.r.fetch(`/u/${ada.p.handle}/friends`)).text();
    expect(own).toContain("Asking to be your friend");
    expect(own).toContain("Ben");
    expect((await news(ada.r)).unread).toBe(0);
    expect(await (await ada.r.fetch("/")).text()).not.toContain("appbar-badge");

    // The old Friends tab leads there.
    const old = await ada.r.fetch("/friends");
    expect(old.status).toBe(307);
    expect(old.headers.get("location")).toMatch(new RegExp(`/u/${ada.p.handle}/friends$`));
  });

  it("are shown to everyone, whatever each one's reading visibility, but never anyone blocked", async () => {
    const ada = await withProfile("Ada", { visibility: "private" });
    const open = await withProfile("Opal", { visibility: "public" });
    const pal = await withProfile("Pal", { visibility: "friends" });
    const shy = await withProfile("Shy", { visibility: "private" });
    for (const f of [open, pal, shy]) await befriend(ada, f);

    const listed = async (r: { fetch: (p: string) => Promise<Response> }) => {
      const res = await r.fetch(`/u/${ada.p.handle}/friends`);
      expect(res.status).toBe(200);
      const html = await res.text();
      return [open, pal, shy].filter((f) => html.includes(`href="/u/${f.p.handle}"`)).map((f) => f.p.handle);
    };
    const all = [open.p.handle, pal.p.handle, shy.p.handle];
    // On someone else's profile the card opens them in a dialog; on your own
    // it leads to your friends page.
    expect(await (await visitor().fetch(`/u/${ada.p.handle}`)).text()).toMatch(
      new RegExp(`href="/u/${ada.p.handle}/friends" aria-haspopup="dialog"`)
    );
    expect(await (await ada.r.fetch(`/u/${ada.p.handle}`)).text()).not.toContain('aria-haspopup="dialog"');
    expect(await listed(ada.r)).toEqual(all);
    expect(await listed(visitor())).toEqual(all);
    const counts = await (await visitor().fetch(`/u/${ada.p.handle}`)).text();
    expect(counts).toMatch(/Friends<\/h2><\/div><p class="profile-big profile-friend-count">3</);

    // Someone Shy blocked doesn't see Shy in Ada's list, nor Shy them.
    const cal = await withProfile("Cal");
    await shy.r.fetch(`/api/blocks/${cal.id}`, { method: "PUT" });
    expect(await listed(cal.r)).toEqual([open.p.handle, pal.p.handle]);
  });
});

describe("profile buttons", () => {
  it("ask, show a request waiting, and show friends", async () => {
    const ada = await withProfile("Ada", { visibility: "public" });
    const ben = await withProfile("Ben");
    const page = async () => (await ben.r.fetch(`/u/${ada.p.handle}`)).text();
    expect(await page()).toContain("Add as a friend");
    await ask(ben.r, ada.p.handle);
    expect(await page()).toContain("Request sent");
    await ask(ada.r, ben.p.handle);
    expect(await page()).toContain(`class="badge">Friends<`);
    // Signed out: no buttons.
    expect(await (await visitor().fetch(`/u/${ada.p.handle}`)).text()).not.toContain("Add as a friend");
  });
});

describe("logs", () => {
  it("never carry handles", async () => {
    const ada = await withProfile("Ada");
    const ben = await withProfile("Ben");
    await ask(ada.r, ben.p.handle);
    await new Promise((r) => setTimeout(r, 300));
    const log = readFileSync(inject("socialLog"), "utf8");
    expect(log).toContain('"event":"friend.requested"');
    expect(log).not.toContain(ben.p.handle);
  });
});
