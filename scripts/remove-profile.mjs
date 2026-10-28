#!/usr/bin/env node
// Takes down a profile (SOCIAL=true servers), for when one is reported: its
// page stops working at once and the username becomes free. Every reader has
// a profile, so the app makes them a fresh one (no bio, friends only, a
// username from their name). Their library and friendships are untouched.
//
//   In Docker:   docker compose exec bookplate remove-profile https://…/u/somehandle
//   Developing:  npm run remove-profile -- somehandle
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
  console.log("Usage: remove-profile <profile link or username>");
  console.log("Takes the profile down and frees its username; the reader gets a fresh one. Their library and friends aren't touched.");
  process.exit(arg === "--help" ? 0 : 1);
}
// The link as it was reported (…/u/handle, maybe with ?year=…), or the
// handle, with or without its @.
const path = arg.replace(/[?#].*$/, "").replace(/\/+$/, "");
const handle = (path.match(/\/u\/([^/]+)/)?.[1] ?? path.split("/").pop()).replace(/^@/, "").toLowerCase();
if (!/^[a-z0-9_]{3,24}$/.test(handle)) fail(`"${arg}" isn't a profile link or username.`);
if (!process.env.DATABASE_URL) fail("DATABASE_URL isn't set — run this inside the Bookplate container.");

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  const { rows } = await db.query(
    'DELETE FROM profile p USING "user" u WHERE p.handle = $1 AND u.id = p.user_id RETURNING u.email',
    [handle]
  );
  if (rows.length === 0) fail(`Nobody has the username @${handle} (the profile may already be gone).`);
  console.log(`✓ Took down ${rows[0].email}'s profile, @${handle}.`);
} catch (e) {
  fail(e instanceof Error ? e.message : String(e));
} finally {
  await db.end();
}
