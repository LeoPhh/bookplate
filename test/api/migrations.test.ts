import { readFileSync } from "fs";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, dropDatabase, withAdmin } from "./db";

// Several app copies starting at once (the hosted version runs more than
// one) all run the migrations on startup. They must not trip over each
// other on a fresh or freshly upgraded database.

const DB = `bookplate_migrate_${process.pid}`;
const journal = JSON.parse(readFileSync(path.join(__dirname, "../../drizzle/meta/_journal.json"), "utf8")) as {
  entries: unknown[];
};

describe("migrations", () => {
  let dbUrl: string;
  beforeAll(async () => {
    dbUrl = await createDatabase(DB);
    process.env.DATABASE_URL = dbUrl;
  });
  afterAll(async () => {
    const { getDb } = await import("@/lib/db");
    await getDb().$client.end();
    await dropDatabase(DB);
  });

  it("run safely when five app copies start at the same time", async () => {
    const { runMigrations } = await import("@/lib/db/migrate");
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => runMigrations()));
    const failures = results.filter((r) => r.status === "rejected").map((r) => String((r as PromiseRejectedResult).reason));
    expect(failures).toEqual([]);

    const applied = await withAdmin(async () => {
      const { Client } = await import("pg");
      const c = new Client({ connectionString: dbUrl });
      await c.connect();
      try {
        return Number((await c.query('select count(*) from "drizzle"."__drizzle_migrations"')).rows[0].count);
      } finally {
        await c.end();
      }
    });
    expect(applied).toBe(journal.entries.length); // each migration recorded exactly once
  });

  it("are a no-op when everything is already applied", async () => {
    const { runMigrations } = await import("@/lib/db/migrate");
    await expect(runMigrations()).resolves.toBeUndefined();
  });
});

// Upgrading a database that already has accounts.
describe("last_seen_at (0006)", () => {
  const UP = `bookplate_lastseen_${process.pid}`;
  afterAll(() => dropDatabase(UP));

  it("starts from each account's latest session, or else its sign-up", async () => {
    const { Client } = await import("pg");
    const c = new Client({ connectionString: await createDatabase(UP) });
    await c.connect();
    const run = async (file: string) => {
      const text = readFileSync(path.join(__dirname, "../../drizzle", `${file}.sql`), "utf8");
      for (const statement of text.split("--> statement-breakpoint")) await c.query(statement);
    };
    try {
      const tags = (journal.entries as { tag: string }[]).map((e) => e.tag);
      for (const tag of tags.slice(0, tags.indexOf("0006_last_seen"))) await run(tag);
      await c.query(`INSERT INTO "user" (id, name, email, created_at) VALUES
        ('used', 'U', 'used@example.com', '2026-01-01'), ('unused', 'N', 'unused@example.com', '2026-02-01')`);
      await c.query(`INSERT INTO session (id, user_id, token, expires_at, updated_at) VALUES
        ('a', 'used', 'ta', '2026-12-01', '2026-03-01'), ('b', 'used', 'tb', '2026-12-01', '2026-05-01')`);
      await run("0006_last_seen");
      const { rows } = await c.query(`SELECT id, to_char(last_seen_at, 'YYYY-MM-DD') AS seen FROM "user" ORDER BY id`);
      expect(rows).toEqual([
        { id: "unused", seen: "2026-02-01" },
        { id: "used", seen: "2026-05-01" },
      ]);
    } finally {
      await c.end();
    }
  });
});
