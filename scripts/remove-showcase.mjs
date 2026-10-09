#!/usr/bin/env node
// Takes down a showcase (a public page of someone's year of reading), for when
// one is reported. Its address stops working at once; the reader's library is
// untouched, and they can make a new one.
//
//   In Docker:   docker compose exec bookplate remove-showcase https://…/s/AbCdEfGhIjKlMnOp
//   Developing:  npm run remove-showcase -- AbCdEfGhIjKlMnOp
//
// Plain Node and the Postgres driver only, so it runs inside the slim Docker
// image.

import pg from "pg";

function fail(message) {
  console.error(`✕ ${message}`);
  process.exit(1);
}

const arg = process.argv[2]?.trim();
if (!arg || arg === "--help") {
  console.log("Usage: remove-showcase <showcase link or id>");
  console.log("Takes the showcase down. The reader's library isn't touched.");
  process.exit(arg === "--help" ? 0 : 1);
}
// The link as it was reported, or just its last part.
const id = arg.replace(/[?#].*$/, "").replace(/\/+$/, "").split("/").pop();
if (!/^[A-Za-z0-9_-]{16}$/.test(id)) fail(`"${arg}" isn't a showcase link.`);
if (!process.env.DATABASE_URL) fail("DATABASE_URL isn't set — run this inside the Bookplate container.");

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  const { rows } = await db.query(
    'DELETE FROM showcase s USING "user" u WHERE s.id = $1 AND u.id = s.user_id RETURNING s.year, u.email',
    [id]
  );
  if (rows.length === 0) fail("There's no showcase at that address (it may already be off).");
  console.log(`✓ Took down ${rows[0].email}'s ${rows[0].year} showcase.`);
} catch (e) {
  fail(e instanceof Error ? e.message : String(e));
} finally {
  await db.end();
}
