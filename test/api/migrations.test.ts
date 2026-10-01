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
