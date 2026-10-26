import { readFileSync } from "fs";
import { describe, expect, inject, it } from "vitest";
import { reader, type Reader } from "./client";
import { makeProfile, socialReader, visitor, withDb, withProfile } from "./socialHelpers";

// Friends (lib/social/friends.ts, invites.ts, notifications.ts): requests by
// handle, invite links, blocking, and the news on the Friends tab. On the
// social test server (SOCIAL=true).

interface Someone {
  id: string;
  name: string;
  handle: string | null;
}
interface Friends {
  friends: Someone[];
  requests: { incoming: Someone[]; outgoing: Someone[] };
  invites: { token: string; expiresAt: string }[];
}
interface News {
  notifications: { kind: string; actor: Someone | null; read: boolean }[];
  unread: number;
}

const friendsOf = (r: Reader) => r.get<Friends>("/api/friends");
const ids = (list: Someone[]) => list.map((p) => p.id);
const news = (r: Reader) => r.get<News>("/api/notifications");

async function ask(r: Reader, handle: string): Promise<Response> {
  return r.json("/api/friends/requests", "POST", { handle });
}

async function makeInvite(r: Reader): Promise<string> {
  const res = await r.fetch("/api/friends/invites", { method: "POST" });
  expect(res.status).toBe(200);
  return ((await res.json()) as { invite: { token: string } }).invite.token;
}

describe("without SOCIAL", () => {
  it("has no friends, invites, blocks or notifications", async () => {
    const r = await reader(); // the plain server
    for (const [path, method] of [
      ["/api/friends", "GET"],
      ["/api/friends/requests", "POST"],
      ["/api/friends/invites", "POST"],
      ["/api/blocks/someone", "PUT"],
      ["/api/notifications", "GET"],
      ["/friends", "GET"],
      ["/f/AAAAAAAAAAAAAAAA", "GET"],
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
    // Not friends yet: Ben's page is for friends.
    expect((await ada.r.fetch(`/u/${ben.p.handle}`)).status).toBe(404);

    expect((await ben.r.json(`/api/friends/requests/${ada.id}`, "POST", { accept: true })).status).toBe(200);
    expect(ids((await friendsOf(ada.r)).friends)).toEqual([ben.id]);
    expect(ids((await friendsOf(ben.r)).friends)).toEqual([ada.id]);
    expect((await friendsOf(ada.r)).requests).toEqual({ incoming: [], outgoing: [] });
    expect((await ada.r.fetch(`/u/${ben.p.handle}`)).status).toBe(200);
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
    const hidden = await withProfile("Hidden", { visibility: "private" });
    const blocker = await withProfile("Blocker");
    await blocker.r.fetch(`/api/blocks/${ada.id}`, { method: "PUT" });
    const answers = await Promise.all(
      [hidden.p.handle, blocker.p.handle, "nobody_has_this"].map(async (h) => {
        const res = await ask(ada.r, h);
        return [res.status, await res.json()];
      })
    );
    for (const a of answers) expect(a).toEqual([404, { error: "Nobody has that handle." }]);
    expect((await ask(ada.r, ada.p.handle)).status).toBe(400);
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
    expect((await ada.r.fetch(`/u/${ben.p.handle}`)).status).toBe(404);
    expect((await ben.r.fetch(`/api/friends/${ada.id}`, { method: "DELETE" })).status).toBe(404);
  });
});

describe("invite links", () => {
  it("show visitors who's inviting, and bring them back after signing up", async () => {
    const ada = await withProfile("Ada Lovelace");
    const token = await makeInvite(ada.r);
    expect(token).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect((await friendsOf(ada.r)).invites).toMatchObject([{ token }]);

    const v = visitor();
    const page = await v.fetch(`/f/${token}`);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain("Ada Lovelace");
    expect(html).toContain(`/signup?next=${encodeURIComponent(`/f/${token}`)}`);
    expect(html).toContain(`/login?next=${encodeURIComponent(`/f/${token}`)}`);
    expect(html).not.toContain(ada.r.email);

    // Signed in, the sign-in page sends them on to the invite.
    const ben = await socialReader("Ben");
    const back = await ben.fetch(`/login?next=${encodeURIComponent(`/f/${token}`)}`);
    expect(back.status).toBe(307);
    expect(back.headers.get("location")).toMatch(new RegExp(`/f/${token}$`));
    const away = await ben.fetch(`/login?next=${encodeURIComponent("//evil.example")}`);
    expect(new URL(away.headers.get("location")!, "http://x").pathname).toBe("/");
  });

  it("make whoever takes one up the inviter's friend, as often as it's used", async () => {
    const ada = await withProfile("Ada");
    const token = await makeInvite(ada.r);
    const ben = await socialReader("Ben"); // no profile needed
    const cat = await socialReader("Cat");
    expect(await (await ben.fetch(`/f/${token}`, { method: "GET" })).text()).toContain("Be friends with Ada");
    expect(await (await ben.json(`/api/friends/invites/${token}`, "POST")).json()).toEqual({ result: "friends" });
    expect(await (await cat.json(`/api/friends/invites/${token}`, "POST")).json()).toEqual({ result: "friends" });
    expect((await friendsOf(ada.r)).friends.map((f) => f.name).sort()).toEqual(["Ben", "Cat"]);
    expect((await news(ada.r)).notifications.map((n) => n.kind)).toEqual(["friend_accepted", "friend_accepted"]);

    expect(await (await ben.json(`/api/friends/invites/${token}`, "POST")).json()).toEqual({ result: "already" });
    expect(await (await ada.r.json(`/api/friends/invites/${token}`, "POST")).json()).toEqual({ result: "own" });
  });

  it("stop working when taken back or run out, and for anyone blocked", async () => {
    const ada = await withProfile("Ada");
    const taken = await makeInvite(ada.r);
    expect((await ada.r.fetch(`/api/friends/invites/${taken}`, { method: "DELETE" })).status).toBe(200);
    const ben = await socialReader("Ben");
    expect((await ben.fetch(`/f/${taken}`)).status).toBe(404);
    expect((await ben.json(`/api/friends/invites/${taken}`, "POST")).status).toBe(404);

    const old = await makeInvite(ada.r);
    await withDb((c) => c.query("UPDATE friend_invite SET expires_at = now() - interval '1 minute' WHERE token = $1", [old]));
    expect((await visitor().fetch(`/f/${old}`)).status).toBe(404);
    expect((await friendsOf(ada.r)).invites.map((i) => i.token)).not.toContain(old);

    const fresh = await makeInvite(ada.r);
    const benId = (await withDb((c) => c.query('SELECT id FROM "user" WHERE email = $1', [ben.email]))).rows[0].id;
    await ada.r.fetch(`/api/blocks/${benId}`, { method: "PUT" });
    expect((await ben.fetch(`/f/${fresh}`)).status).toBe(404);
    expect((await ben.json(`/api/friends/invites/${fresh}`, "POST")).status).toBe(404);
    expect((await visitor().fetch("/f/not-a-real-token!")).status).toBe(404);
  });

  it("can only be taken back by their maker", async () => {
    const ada = await withProfile("Ada");
    const token = await makeInvite(ada.r);
    const ben = await socialReader();
    expect((await ben.fetch(`/api/friends/invites/${token}`, { method: "DELETE" })).status).toBe(404);
    expect((await visitor().fetch(`/f/${token}`)).status).toBe(200);
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

describe("the Friends tab", () => {
  it("badges what's new, and opening it reads it", async () => {
    const ada = await withProfile("Ada");
    const ben = await withProfile("Ben");
    await ask(ben.r, ada.p.handle);

    const library = await (await ada.r.fetch("/")).text();
    expect(library).toContain('href="/friends"');
    expect(library).toMatch(/class="appbar-badge"[^>]*>1</);

    const tab = await (await ada.r.fetch("/friends")).text();
    expect(tab).toContain("Asking to be your friend");
    expect(tab).toContain("Ben");
    expect((await news(ada.r)).unread).toBe(0);
    expect(await (await ada.r.fetch("/")).text()).not.toContain("appbar-badge");
  });

  it("asks readers without a profile to make one", async () => {
    const r = await socialReader();
    expect(await (await r.fetch("/friends")).text()).toContain("make your profile");
    await makeProfile(r, { handle: `x${Date.now()}`.slice(0, 20) });
    expect(await (await r.fetch("/friends")).text()).not.toContain("make your profile");
  });
});

describe("profile buttons", () => {
  it("ask, show a request waiting, and show friends", async () => {
    const ada = await withProfile("Ada", { visibility: "public" });
    const ben = await withProfile("Ben");
    const page = async () => (await ben.r.fetch(`/u/${ada.p.handle}`)).text();
    expect(await page()).toContain("Ask to be friends");
    await ask(ben.r, ada.p.handle);
    expect(await page()).toContain("Request sent");
    await ask(ada.r, ben.p.handle);
    expect(await page()).toContain(`class="badge">Friends<`);
    // Signed out: no buttons.
    expect(await (await visitor().fetch(`/u/${ada.p.handle}`)).text()).not.toContain("Ask to be friends");
  });
});

describe("logs", () => {
  it("never carry invite tokens or handles", async () => {
    const ada = await withProfile("Ada");
    const ben = await withProfile("Ben");
    const token = await makeInvite(ada.r);
    await ask(ada.r, ben.p.handle);
    await new Promise((r) => setTimeout(r, 300));
    const log = readFileSync(inject("socialLog"), "utf8");
    expect(log).toContain('"event":"friend.requested"');
    expect(log).toContain('"event":"friend.invite_made"');
    expect(log).not.toContain(token);
    expect(log).not.toContain(ben.p.handle);
  });
});
