import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { config } from "../config";
import * as schema from "./schema";

// One pool per server process. Kept on globalThis so dev-mode hot reloads
// don't open a new pool on every edit.
const g = globalThis as unknown as { bookplateDb?: NodePgDatabase<typeof schema> & { $client: Pool } };

export function getDb() {
  if (!g.bookplateDb) {
    g.bookplateDb = drizzle(new Pool({ connectionString: config.databaseUrl, max: 10 }), { schema });
  }
  return g.bookplateDb;
}

export { schema };
