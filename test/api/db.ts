import { Client } from "pg";

// Throwaway databases for tests, on the dev Postgres (`npm run db:up`) or
// whatever TEST_DATABASE_ADMIN_URL points at.

export const ADMIN_URL = process.env.TEST_DATABASE_ADMIN_URL ?? "postgres://bookplate:bookplate@localhost:5433/bookplate";

export async function withAdmin<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: ADMIN_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

// Creates an empty database and returns its connection URL.
export async function createDatabase(name: string): Promise<string> {
  await withAdmin(async (c) => {
    await c.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await c.query(`CREATE DATABASE ${name}`);
  });
  const url = new URL(ADMIN_URL);
  url.pathname = `/${name}`;
  return url.toString();
}

export async function dropDatabase(name: string): Promise<void> {
  await withAdmin((c) => c.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`));
}
