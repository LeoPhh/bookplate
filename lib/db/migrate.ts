import path from "path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getDb } from ".";

// Any fixed number works; it just has to be the same in every app copy.
const MIGRATION_LOCK = 4_726_315_908;

// Brings the database schema up to date from the SQL files in drizzle/
// (copied next to server.js in the Docker image). Runs once at server start, so
// upgrading is just pulling a newer image.
//
// Several copies of the app can start at once (the hosted version runs more
// than one). A Postgres advisory lock lets one copy migrate while the others
// wait; when they get the lock, there's nothing left to do.
export async function runMigrations(): Promise<void> {
  const db = getDb();
  const lock = await db.$client.connect();
  try {
    await lock.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK]);
    await migrate(db, { migrationsFolder: path.join(/* turbopackIgnore: true */ process.cwd(), "drizzle") });
  } finally {
    // Closing the connection would release the lock too; this is just tidier.
    await lock.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK]).catch(() => {});
    lock.release();
  }
}
