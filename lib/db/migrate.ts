import path from "path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getDb } from ".";

// Brings the database schema up to date from the SQL files in drizzle/
// (copied next to server.js in the Docker image). Runs once at server start, so
// upgrading is just pulling a newer image.
export async function runMigrations(): Promise<void> {
  const db = getDb();
  await migrate(db, { migrationsFolder: path.join(/* turbopackIgnore: true */ process.cwd(), "drizzle") });
}
