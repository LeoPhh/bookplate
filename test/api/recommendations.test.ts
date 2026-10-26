import { strFromU8, unzipSync } from "fflate";
import { readFileSync } from "fs";
import { describe, expect, inject, it } from "vitest";
import { book, reader, type Reader } from "./client";
import { withDb, withProfile } from "./socialHelpers";

// Recommendations (lib/social/recs.ts): a friend suggests a book, the other
// adds it to their to-read shelf or says it's not for them. On the social
// test server (SOCIAL=true, LIMIT_BOOKS=50).

interface Rec {
  id: string;
  title: string;
  author: string;
  note: string | null;
  state: string;
  who: { id: string; name: string };
  inLibrary?: boolean;
}
interface Recs {
  inbox: Rec[];
  sent: Rec[];
}

const recs = (r: Reader) => r.get<Recs>("/api/recommendations");
const titles = (list: Rec[]) => list.map((x) => x.title);

async function friends() {
  const ada = await withProfile("Ada", { visibility: "friends" });
  const ben = await withProfile("Ben", { visibility: "friends" });
  await ada.r.json("/api/friends/requests", "POST", { handle: ben.p.handle });
  await ben.r.json("/api/friends/requests", "POST", { handle: ada.p.handle });
  return { ada, ben };
}

async function recommend(from: Reader, to: string, body: Record<string, unknown> = {}): Promise<Response> {
  return from.json("/api/recommendations", "POST", { to, title: "Middlemarch", author: "George Eliot", ...body });
}

async function sent(from: Reader, to: string, body: Record<string, unknown> = {}): Promise<string> {
  const res = await recommend(from, to, body);
  expect(res.status).toBe(200);
  return ((await res.json()) as { id: string }).id;
}

describe("without SOCIAL", () => {
  it("has no recommendations", async () => {
    const r = await reader(); // the plain server
    expect((await r.fetch("/api/recommendations")).status).toBe(404);
    expect((await r.json("/api/recommendations", "POST", { to: "x", title: "y", author: "z" })).status).toBe(404);
  });
});

describe("recommending a book", () => {
  it("is for friends only", async () => {
    const ada = await withProfile("Ada", { visibility: "public" });
    const stranger = await withProfile("Stranger");
    const res = await recommend(stranger.r, ada.id);
    expect(res.status).toBe(404);
    expect((await recs(ada.r)).inbox).toEqual([]);
    expect((await recommend(ada.r, ada.id)).status).toBe(400);
    // And the button is only on friends' profiles.
    expect(await (await stranger.r.fetch(`/u/${ada.p.handle}`)).text()).not.toContain("Recommend a book");
  });

  it("puts it in the friend's inbox, with a note, and tells them", async () => {
    const { ada, ben } = await friends();
    await sent(ada.r, ben.id, { note: "You'll love Dorothea." });
    expect((await recs(ben.r)).inbox).toMatchObject([
      { title: "Middlemarch", author: "George Eliot", note: "You'll love Dorothea.", state: "new", who: { id: ada.id, name: "Ada" }, inLibrary: false },
    ]);
    expect((await recs(ada.r)).sent).toMatchObject([{ title: "Middlemarch", state: "new", who: { id: ben.id } }]);
    const news = await ben.r.get<{ notifications: { kind: string }[]; unread: number }>("/api/notifications");
    expect(news.notifications.map((n) => n.kind)).toContain("recommendation");
    expect(await (await ada.r.fetch(`/u/${ben.p.handle}`)).text()).toContain("Recommend a book");

    // Once is enough while it waits.
    expect((await recommend(ada.r, ben.id, { title: "middlemarch" })).status).toBe(409);
  });

  it("is seen once the friend opens Friends, which the sender can tell", async () => {
    const { ada, ben } = await friends();
    await sent(ada.r, ben.id);
    const tab = await (await ben.r.fetch("/friends")).text();
    expect(tab).toContain("Recommended to you");
    expect(tab).toContain("Middlemarch");
    expect((await recs(ada.r)).sent[0].state).toBe("seen");
  });

  it("is limited to a few dozen a day", async () => {
    const { ada, ben } = await friends();
    await withDb((c) =>
      c.query("INSERT INTO auth_throttle (key, failures, window_start) VALUES ($1, 30, localtimestamp)", [`recommend:${ada.id}`])
    );
    expect((await recommend(ada.r, ben.id)).status).toBe(429);
  });
});

describe("answering a recommendation", () => {
  it("adds the book to the to-read shelf, which the sender sees", async () => {
    const { ada, ben } = await friends();
    const id = await sent(ada.r, ben.id, { olWorkId: "OL893415W" });
    const res = await ben.r.json(`/api/recommendations/${id}`, "PATCH", { action: "add" });
    expect(res.status).toBe(200);
    const { bookId } = (await res.json()) as { bookId: string };
    const { books } = await ben.r.get<{ books: { id: string; title: string; status: string; olWorkId?: string; coverImage?: string }[] }>("/api/books");
    expect(books.find((b) => b.id === bookId)).toMatchObject({ title: "Middlemarch", status: "to-read", olWorkId: "OL893415W" });
    expect(books.find((b) => b.id === bookId)?.coverImage).toBeUndefined(); // covers stay with their owners
    expect((await recs(ben.r)).inbox).toEqual([]);
    expect((await recs(ada.r)).sent[0].state).toBe("added");
    // Answered: no taking it back, no answering again.
    expect((await ada.r.fetch(`/api/recommendations/${id}`, { method: "DELETE" })).status).toBe(404);
    expect((await ben.r.json(`/api/recommendations/${id}`, "PATCH", { action: "add" })).status).toBe(404);
  });

  it("says so when the book is in the library already, and doesn't add it twice", async () => {
    const { ada, ben } = await friends();
    await ben.r.json("/api/books/mm", "PUT", book("mm", { title: "Middlemarch", author: "George Eliot", status: "read" }));
    const id = await sent(ada.r, ben.id);
    expect((await recs(ben.r)).inbox[0].inLibrary).toBe(true);
    const res = await ben.r.json(`/api/recommendations/${id}`, "PATCH", { action: "add" });
    expect(await res.json()).toEqual({ bookId: "mm" });
    expect((await ben.r.get<{ books: unknown[] }>("/api/books")).books).toHaveLength(1);
  });

  it("can say it's not for them, which the sender only sees as seen", async () => {
    const { ada, ben } = await friends();
    const id = await sent(ada.r, ben.id);
    expect((await ben.r.json(`/api/recommendations/${id}`, "PATCH", { action: "dismiss" })).status).toBe(200);
    expect((await recs(ben.r)).inbox).toEqual([]);
    expect((await recs(ada.r)).sent[0].state).toBe("seen");
    expect((await ben.r.get<{ books: unknown[] }>("/api/books")).books).toEqual([]);
    expect((await ben.r.json(`/api/recommendations/${id}`, "PATCH", { action: "maybe" })).status).toBe(400);
    expect((await ben.r.json(`/api/recommendations/${id}`, "PATCH", { action: "add" })).status).toBe(404); // answered
  });

  it("stays within the server's book limit", async () => {
    const { ada, ben } = await friends();
    await withDb((c) =>
      c.query(
        `INSERT INTO book (user_id, id, title, author, status, added_at)
         SELECT $1, 'b' || g, 'Book ' || g, 'Author', 'to-read', '2026-01-01' FROM generate_series(1, 50) g`,
        [ben.id]
      )
    );
    const id = await sent(ada.r, ben.id);
    const res = await ben.r.json(`/api/recommendations/${id}`, "PATCH", { action: "add" });
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: string }).error).toContain("limit");
    expect(titles((await recs(ben.r)).inbox)).toEqual(["Middlemarch"]); // still there to answer later
  });

  it("is only for its recipient", async () => {
    const { ada, ben } = await friends();
    const id = await sent(ada.r, ben.id);
    const cat = await withProfile("Cat");
    expect((await cat.r.json(`/api/recommendations/${id}`, "PATCH", { action: "add" })).status).toBe(404);
    expect((await ada.r.json(`/api/recommendations/${id}`, "PATCH", { action: "add" })).status).toBe(404);
    expect((await cat.r.fetch(`/api/recommendations/${id}`, { method: "DELETE" })).status).toBe(404);
  });
});

describe("taking recommendations back", () => {
  it("removes it and its notification, while unanswered", async () => {
    const { ada, ben } = await friends();
    const id = await sent(ada.r, ben.id);
    expect((await ada.r.fetch(`/api/recommendations/${id}`, { method: "DELETE" })).status).toBe(200);
    expect((await recs(ben.r)).inbox).toEqual([]);
    const news = await ben.r.get<{ notifications: { kind: string }[] }>("/api/notifications");
    expect(news.notifications.map((n) => n.kind)).not.toContain("recommendation");
  });

  it("happens to waiting ones on unfriending or blocking, either way", async () => {
    const { ada, ben } = await friends();
    await sent(ada.r, ben.id, { title: "One" });
    const kept = await sent(ada.r, ben.id, { title: "Two" });
    await ben.r.json(`/api/recommendations/${kept}`, "PATCH", { action: "add" });
    await sent(ben.r, ada.id, { title: "Three" });
    expect((await ben.r.fetch(`/api/friends/${ada.id}`, { method: "DELETE" })).status).toBe(200);
    expect((await recs(ben.r)).inbox).toEqual([]);
    expect((await recs(ada.r)).inbox).toEqual([]);
    expect(titles((await recs(ada.r)).sent)).toEqual(["Two"]); // answered ones stay

    const again = await friends();
    await sent(again.ada.r, again.ben.id);
    await again.ben.r.fetch(`/api/blocks/${again.ada.id}`, { method: "PUT" });
    expect((await recs(again.ben.r)).inbox).toEqual([]);
  });
});

describe("logs", () => {
  it("never carry the book or the note", async () => {
    const { ada, ben } = await friends();
    await sent(ada.r, ben.id, { title: "A Title Nobody Logs", note: "A note nobody logs" });
    await new Promise((r) => setTimeout(r, 300));
    const log = readFileSync(inject("socialLog"), "utf8");
    expect(log).toContain('"event":"recommendation.sent"');
    expect(log).not.toContain("A Title Nobody Logs");
    expect(log).not.toContain("A note nobody logs");
  });
});

describe("the export", () => {
  it("includes the reader's profile, friends and recommendations, which never go back in", async () => {
    const { ada, ben } = await friends();
    const id = await sent(ben.r, ada.id, { title: "Dune", author: "Frank Herbert", note: "Sand!" });
    await ada.r.json(`/api/recommendations/${id}`, "PATCH", { action: "dismiss" });
    await sent(ada.r, ben.id);

    const files = unzipSync(new Uint8Array(await (await ada.r.fetch("/api/export")).arrayBuffer()));
    const social = JSON.parse(strFromU8(files["social.json"]));
    expect(social.profile).toMatchObject({ handle: ada.p.handle });
    expect(social.friends).toMatchObject([{ name: "Ben", handle: ben.p.handle }]);
    expect(social.recommendationsSent).toMatchObject([{ title: "Middlemarch", to: { name: "Ben" }, state: "new" }]);
    expect(social.recommendationsReceived).toMatchObject([{ title: "Dune", note: "Sand!", from: { name: "Ben" }, state: "dismissed" }]);
    expect(JSON.stringify(social)).not.toContain(ben.r.email);
    // Ben's own export never says Ada turned his down.
    const bens = JSON.parse(strFromU8(unzipSync(new Uint8Array(await (await ben.r.fetch("/api/export")).arrayBuffer()))["social.json"]));
    expect(bens.recommendationsSent.find((x: { title: string }) => x.title === "Dune").state).toBe("seen");

    // Importing it changes no friendships.
    const cat = await withProfile("Cat");
    const zip = await (await ada.r.fetch("/api/export")).blob();
    expect((await cat.r.upload("/api/import", { file: zip })).status).toBe(200);
    expect((await cat.r.get<{ friends: unknown[] }>("/api/friends")).friends).toEqual([]);
  });

  it("has no social part on a server without SOCIAL", async () => {
    const r = await reader();
    const files = unzipSync(new Uint8Array(await (await r.fetch("/api/export")).arrayBuffer()));
    expect(Object.keys(files)).not.toContain("social.json");
  });
});
