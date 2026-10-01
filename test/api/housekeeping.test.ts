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

  it("clears out old rate-limit entries", async () => {
    await sql(`INSERT INTO auth_throttle (key, failures, window_start) VALUES ('old', 1, localtimestamp - interval '2 days'), ('new', 1, localtimestamp)`);
    const { pruneThrottle } = await import("@/lib/authThrottle");
    await pruneThrottle(24 * 60 * 60 * 1000);
    expect((await sql(`SELECT key FROM auth_throttle`)).rows.map((r) => r.key)).toEqual(["new"]);
  });
});
