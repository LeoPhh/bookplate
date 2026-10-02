import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { limitedBaseUrl, Visitor } from "./client";
import { createDatabase, dropDatabase } from "./db";
import { METRICS_TOKEN } from "./setup";

describe("the metrics endpoint", () => {
  it("answers only with the token", async () => {
    const v = new Visitor();
    expect((await v.fetch("/api/metrics")).status).toBe(401);
    expect((await v.fetch("/api/metrics", { headers: { Authorization: "Bearer wrong" } })).status).toBe(401);
    const res = await v.fetch("/api/metrics", { headers: { Authorization: `Bearer ${METRICS_TOKEN}` } });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    const text = await res.text();
    expect(text).toContain("bookplate_info{");
    expect(text).toMatch(/^bookplate_accounts\{confirmed="true"\} \d+$/m);
  });

  it("doesn't exist on a server without a token", async () => {
    expect((await new Visitor(undefined, limitedBaseUrl()).fetch("/api/metrics")).status).toBe(404);
  });
});

// The counting itself, against a fresh database with known contents.
const DB = `bookplate_metrics_${process.pid}`;

describe("counting totals", () => {
  let q: (query: string) => Promise<unknown>;
  beforeAll(async () => {
    process.env.DATABASE_URL = await createDatabase(DB);
    const { runMigrations } = await import("@/lib/db/migrate");
    await runMigrations();
    const { getDb } = await import("@/lib/db");
    q = (query) => getDb().$client.query(query);
  });
  afterAll(async () => {
    const { getDb } = await import("@/lib/db");
    await getDb().$client.end();
    await dropDatabase(DB);
  });

  it("counts accounts, activity and books correctly", async () => {
    await q(`INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at) VALUES
      ('a', 'a', 'a@x.org', true,  localtimestamp - interval '40 days', now()),
      ('b', 'b', 'b@x.org', true,  localtimestamp - interval '3 days',  now()),
      ('c', 'c', 'c@x.org', false, localtimestamp - interval '1 hour',  now())`);
    await q(`INSERT INTO session (id, user_id, token, expires_at, updated_at) VALUES
      ('s1', 'a', 't1', now() + interval '1 day', localtimestamp - interval '2 hours'),
      ('s2', 'a', 't2', now() + interval '1 day', localtimestamp - interval '10 days'),
      ('s3', 'b', 't3', now() + interval '1 day', localtimestamp - interval '5 days')`);
    const book = (user: string, id: string, status: string) =>
      `('${user}', '${id}', 'T', 'A', '${status}', '2026-01-01')`;
    await q(`INSERT INTO book (user_id, id, title, author, status, added_at) VALUES
      ${[book("a", "1", "read"), book("a", "2", "read"), book("a", "3", "reading"), book("b", "1", "to-read")].join(",")}`);
    await q(`INSERT INTO vocab_entry (user_id, id, word, definition, added_at) VALUES ('a', 'w', 'w', 'd', '2026-01-01')`);

    const { collectTotals } = await import("@/lib/metrics");
    const t = await collectTotals();
    expect(t.accounts).toEqual({ confirmed: 2, unconfirmed: 1 });
    expect(t.newAccounts).toEqual({ "1d": 1, "7d": 2, "30d": 2 });
    expect(t.activeAccounts).toEqual({ "1d": 1, "7d": 2, "30d": 2 });
    expect(t.books).toEqual({ read: 2, reading: 1, "to-read": 1 });
    expect(t.booksPerAccount).toEqual({ p50: 1, p90: 3, max: 3 });
    expect(t).toMatchObject({ notes: 0, words: 1, progressEntries: 0 });
  });
});
