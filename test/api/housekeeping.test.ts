import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, dropDatabase } from "./db";

// The periodic tidy-up (lib/housekeeping.ts), run directly against a fresh
// database set up like a server with open registration and email.

const DB = `bookplate_housekeeping_${process.pid}`;

describe("removing accounts that were never confirmed", () => {
  let sql: (query: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
  beforeAll(async () => {
    process.env.DATABASE_URL = await createDatabase(DB);
    process.env.REGISTRATION = "open";
    process.env.SMTP_HOST = "mail.example.com";
    const { runMigrations } = await import("@/lib/db/migrate");
    await runMigrations();
    const { getDb } = await import("@/lib/db");
    sql = (query, params) => getDb().$client.query(query, params);
  });
  afterAll(async () => {
    const { getDb } = await import("@/lib/db");
    await getDb().$client.end();
    await dropDatabase(DB);
  });

  const addUser = (id: string, verified: boolean, daysAgo: number, image: string | null = null) =>
    sql(
      `INSERT INTO "user" (id, name, email, email_verified, image, created_at, updated_at)
       VALUES ($1, $1, $1 || '@example.com', $2, $3, now() - make_interval(days => $4), now())`,
      [id, verified, image, daysAgo]
    );

  it("removes only old, unconfirmed accounts that never stored anything", async () => {
    await addUser("stale", false, 8);
    await addUser("recent", false, 2);
    await addUser("confirmed", true, 30);
    // Unconfirmed but in use — e.g. made before email was set up.
    await addUser("has-book", false, 30);
    await sql(`INSERT INTO book (user_id, id, title, author, status, added_at) VALUES ('has-book', 'b1', 'T', 'A', 'read', '2026-01-01')`);
    await addUser("has-photo", false, 30, "/api/avatar/x.jpg");
    await addUser("has-session", false, 30);
    await sql(
      `INSERT INTO session (id, user_id, token, expires_at) VALUES ('s1', 'has-session', 't1', now() + interval '1 day')`
    );

    const { removeUnverifiedAccounts } = await import("@/lib/housekeeping");
    expect(await removeUnverifiedAccounts()).toBe(1);
    const left = (await sql(`SELECT id FROM "user" ORDER BY id`)).rows.map((r) => r.id);
    expect(left).toEqual(["confirmed", "has-book", "has-photo", "has-session", "recent"]);
  });

  it("removes run-out sessions and links, and strips addresses from old sessions", async () => {
    await addUser("signed-in", true, 60);
    await sql(
      `INSERT INTO session (id, user_id, token, expires_at, ip_address, user_agent) VALUES
       ('old', 'signed-in', 'tok-old', now() - interval '3 days', NULL, NULL),
       ('live', 'signed-in', 'tok-live', now() + interval '20 days', '203.0.113.9',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.6; rv:131.0) Gecko/20100101 Firefox/131.0')`
    );
    await sql(
      `INSERT INTO verification (id, identifier, value, expires_at) VALUES
       ('v-old', 'x', 'y', now() - interval '3 days'), ('v-live', 'x', 'y', now() + interval '1 hour')`
    );
    const { tidySessions } = await import("@/lib/housekeeping");
    expect(await tidySessions()).toEqual({ expired: 1, stripped: 1 });
    expect((await sql(`SELECT id, ip_address, user_agent FROM session WHERE user_id = 'signed-in'`)).rows).toEqual([
      { id: "live", ip_address: null, user_agent: null },
    ]);
    expect((await sql(`SELECT id FROM verification`)).rows.map((r) => r.id)).toEqual(["v-live"]);
  });

  it("clears out old rate-limit entries", async () => {
    await sql(`INSERT INTO auth_throttle (key, failures, window_start) VALUES ('old', 1, localtimestamp - interval '2 days'), ('new', 1, localtimestamp)`);
    const { pruneThrottle } = await import("@/lib/authThrottle");
    await pruneThrottle(24 * 60 * 60 * 1000);
    expect((await sql(`SELECT key FROM auth_throttle`)).rows.map((r) => r.key)).toEqual(["new"]);
  });
});
