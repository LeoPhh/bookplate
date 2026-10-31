import { randomUUID } from "crypto";
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
    const ben = await withProfile("Ben", { visibility: "private" });

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
  it("are under the profile, not a tab of their own; the bell badges what's new, and opening them reads it", async () => {
    const ada = await withProfile("Ada");
    const ben = await withProfile("Ben");
    await ask(ben.r, ada.p.handle);

    const library = await (await ada.r.fetch("/")).text();
    expect(library).not.toContain('href="/friends"');
    expect(library).toMatch(/aria-label="Notifications, 1 new"/);
    expect(library).toContain('aria-label="Menu"');
    expect(library).toMatch(/<span class="appbar-badge">1</);

    const profile = await (await ada.r.fetch(`/u/${ada.p.handle}`)).text();
    expect(profile).toContain(`href="/u/${ada.p.handle}/friends"`);
    expect(profile).toContain("1 new");

    const own = await (await ada.r.fetch(`/u/${ada.p.handle}/friends`)).text();
    expect(own).toContain("Asking to be your friend");
    expect(own).toContain("Ben");
    expect((await news(ada.r)).unread).toBe(0);
    expect(await (await ada.r.fetch("/")).text()).not.toContain("appbar-badge");

    // An accepted request is shown nowhere on it, so the bell keeps that one.
    expect((await ada.r.json(`/api/friends/requests/${ben.id}`, "POST", { accept: true })).status).toBe(200);
    await ada.r.fetch(`/u/${ada.p.handle}/friends`);
    await ben.r.fetch(`/u/${ben.p.handle}/friends`);
    expect((await news(ben.r)).unread).toBe(1);

    // The old Friends tab leads there.
    const old = await ada.r.fetch("/friends");
    expect(old.status).toBe(307);
    expect(old.headers.get("location")).toMatch(new RegExp(`/u/${ada.p.handle}/friends$`));
  });

  it("are only counted on a private profile, for anyone but its friends", async () => {
    const ada = await withProfile("Ada", { visibility: "private" });
    const pal = await withProfile("Pal", { visibility: "public" });
    const cal = await withProfile("Cal");
    await befriend(ada, pal);
    const profile = `/u/${ada.p.handle}`;
    for (const r of [visitor(), cal.r]) {
      const html = await (await r.fetch(profile)).text();
      expect(html).toMatch(/profile-friend-count">1</);
      expect(html).toContain("Only their friends can see who they are");
      expect(html).not.toContain(pal.p.handle);
      expect(html).not.toContain("See all friends");
      expect((await r.fetch(`${profile}/friends`)).status).toBe(404);
    }
    expect(await (await pal.r.fetch(profile)).text()).toContain(`href="/u/${pal.p.handle}"`);
    expect((await pal.r.fetch(`${profile}/friends`)).status).toBe(200);
    // They stay in the list of a public friend.
    expect(await (await visitor().fetch(`/u/${pal.p.handle}/friends`)).text()).toContain(`href="/u/${ada.p.handle}"`);
  });

  it("are shown to everyone on a public profile, but never anyone blocked", async () => {
    const ada = await withProfile("Ada", { visibility: "public" });
    const open = await withProfile("Opal", { visibility: "public" });
    const pal = await withProfile("Pal", { visibility: "private" });
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
    expect(await page()).toContain("Add friend");
    await ask(ben.r, ada.p.handle);
    expect(await page()).toContain("Cancel friend request");
    const theirs = await (await ada.r.fetch(`/u/${ben.p.handle}`)).text();
    expect(theirs).toContain(">Accept<");
    expect(theirs).toContain(">Decline<");
    await ask(ada.r, ben.p.handle);
    expect(await page()).toContain("Unfriend");
    // Signed out: no buttons.
    expect(await (await visitor().fetch(`/u/${ada.p.handle}`)).text()).not.toContain("Add friend");
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

describe("finding people", () => {
  interface Found extends Someone {
    standing: string;
  }
  const search = async (r: Reader, q: string) =>
    (await r.get<{ results: Found[] }>(`/api/friends/search?q=${encodeURIComponent(q)}`)).results;
  // A word nobody else in the test database has.
  const word = () => `z${randomUUID().replaceAll("-", "").slice(0, 12)}`;

  it("goes by part of a name or username, in any case, closest first", async () => {
    const w = word();
    const ada = await withProfile("Ada");
    const byName = await withProfile(`Grace ${w}`);
    const byHandle = await withProfile("Ben", { handle: `${w}_x`.slice(0, 24) });
    expect(ids(await search(ada.r, w.toUpperCase()))).toEqual([byHandle.id, byName.id]);
    expect(ids(await search(ada.r, `@${byHandle.p.handle}`))).toEqual([byHandle.id]);
  });

  it("says where each person stands, and follows it", async () => {
    const w = word();
    const ada = await withProfile("Ada");
    const ben = await withProfile(`Ben ${w}`);
    const standingOfBen = async () => (await search(ada.r, w))[0].standing;
    expect(await standingOfBen()).toBe("none");
    await ask(ada.r, ben.p.handle);
    expect(await standingOfBen()).toBe("sent");
    expect((await search(ben.r, ada.p.handle))[0].standing).toBe("received");
    await ask(ben.r, ada.p.handle);
    expect(await standingOfBen()).toBe("friends");
  });

  it("leaves out the reader, anyone blocked either way, and email addresses", async () => {
    const w = word();
    const ada = await withProfile(`Ada ${w}`);
    const ben = await withProfile(`Ben ${w}`);
    const cy = await withProfile(`Cy ${w}`);
    expect(ids(await search(ada.r, w))).toEqual([ben.id, cy.id]);
    expect(await search(ada.r, cy.r.email)).toEqual([]);

    expect((await ada.r.fetch(`/api/blocks/${ben.id}`, { method: "PUT" })).status).toBe(200);
    expect(ids(await search(ada.r, w))).toEqual([cy.id]);
    expect(ids(await search(ben.r, w))).toEqual([cy.id]);
  });

  it("treats % and _ as themselves, and needs two characters", async () => {
    const ada = await withProfile("Ada");
    expect(await search(ada.r, "%%")).toEqual([]);
    expect(await search(ada.r, "a")).toEqual([]);
    const w = word();
    const under = await withProfile("Ben", { handle: `${w.slice(0, 6)}_${w.slice(6, 12)}` });
    expect(ids(await search(ada.r, `${w.slice(0, 6)}_`))).toEqual([under.id]);
    expect(await search(ada.r, `${w.slice(0, 5)}__`)).toEqual([]);
  });

  it("is for signed-in readers, and only so often", async () => {
    expect((await visitor().fetch("/api/friends/search?q=ada")).status).toBe(401);
    const ada = await withProfile("Ada");
    for (let i = 0; i < 60; i++) await search(ada.r, "ab");
    const res = await ada.r.fetch("/api/friends/search?q=ab");
    expect(res.status).toBe(429);
  });
});

describe("the bell", () => {
  it("lists requests waiting for an answer until they're answered, with the news kept apart", async () => {
    const ada = await withProfile("Ada");
    const ben = await withProfile("Ben");
    const cy = await withProfile("Cy");
    await ask(ben.r, ada.p.handle);
    await ask(cy.r, ada.p.handle);
    const incoming = async () => ids((await ada.r.get<{ incoming: Someone[] }>("/api/notifications")).incoming);
    expect((await incoming()).sort()).toEqual([ben.id, cy.id].sort());

    // Seen, but still waiting for an answer.
    expect((await ada.r.fetch("/api/notifications/read", { method: "POST" })).status).toBe(200);
    expect((await news(ada.r)).unread).toBe(0);
    expect((await incoming()).sort()).toEqual([ben.id, cy.id].sort());
    expect(await (await ada.r.fetch("/")).text()).toContain('aria-label="Notifications"');

    expect((await ada.r.json(`/api/friends/requests/${ben.id}`, "POST", { accept: true })).status).toBe(200);
    expect((await ada.r.json(`/api/friends/requests/${cy.id}`, "POST", { accept: false })).status).toBe(200);
    expect(await incoming()).toEqual([]);
    expect(await news(ben.r)).toMatchObject({ unread: 1, notifications: [{ kind: "friend_accepted", actor: { id: ada.id } }] });
    expect((await news(cy.r)).notifications).toEqual([]);
  });

  it("isn't there without social features", async () => {
    const r = await reader();
    expect(await (await r.fetch("/")).text()).not.toContain("Notifications");
  });
});

describe("the friends page's tabs", () => {
  const selected = (page: string, tab: string) =>
    new RegExp(`id="friends-tab-${tab}"[^>]*aria-selected="true"|aria-selected="true"[^>]*id="friends-tab-${tab}"`).test(page);

  it("opens on Friends, or the tab asked for, even by way of /friends", async () => {
    const ada = await withProfile("Ada");
    const page = async (query = "") => (await ada.r.fetch(`/u/${ada.p.handle}/friends${query}`)).text();
    expect(selected(await page(), "friends")).toBe(true);
    expect(selected(await page("?tab=requests"), "requests")).toBe(true);
    expect(selected(await page("?tab=nonsense"), "friends")).toBe(true);
    const by = await ada.r.fetch("/friends?tab=recommendations");
    expect(by.headers.get("location")).toContain(`/u/${ada.p.handle}/friends?tab=recommendations`);
  });

  it("has everything on the page for its tabs", async () => {
    const ada = await withProfile("Ada");
    const ben = await withProfile("Ben");
    await ask(ben.r, ada.p.handle);
    const page = await (await ada.r.fetch(`/u/${ada.p.handle}/friends`)).text();
    expect(page).toContain("Book Recommendations");
    expect(page).toContain("Asking to be your friend");
    expect(page).toContain("Find new friends");
    expect(page).not.toContain("Lately");
  });
});
