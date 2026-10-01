#!/usr/bin/env node
// Resets a Bookplate account's password from the server, for when its owner
// can't use "Forgot password?" (no email set up, or no access to the inbox).
//
//   In Docker:   docker compose exec bookplate reset-password you@example.com
//   Developing:  npm run reset-password -- you@example.com
//
// It asks for the new password twice without showing it, then signs out every
// device. Only someone with access to the server can run it.
//
// Plain Node and the Postgres driver only, so it runs inside the slim Docker
// image. Passwords are hashed exactly like Better Auth does (scrypt, N=16384,
// r=16, p=1, 64-byte key, "salt:key" in hex) — see @better-auth/utils.

import { randomBytes, scrypt } from "node:crypto";
import pg from "pg";

const MIN_LENGTH = 8;
const MAX_LENGTH = 128;

function fail(message) {
  console.error(`✕ ${message}`);
  process.exit(1);
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, 64, { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 }, (err, key) =>
      err ? reject(err) : resolve(`${salt}:${key.toString("hex")}`)
    )
  );
}

// Reads a line from the terminal without echoing it.
function askHidden(prompt) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (chars) => {
      for (const c of chars) {
        if (c === "\r" || c === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (c === "\u0003") {
          process.stdout.write("\n");
          process.exit(130); // Ctrl+C
        }
        if (c === "\u007f" || c === "\b") {
          if (value.length) {
            value = value.slice(0, -1);
            process.stdout.write("\b \b");
          }
        } else {
          value += c;
          process.stdout.write("•");
        }
      }
    };
    stdin.on("data", onData);
  });
}

async function readStdin() {
  let data = "";
  for await (const chunk of process.stdin) data += chunk;
  return data.replace(/\r?\n$/, "");
}

const args = process.argv.slice(2);
const fromStdin = args.includes("--password-stdin");
const email = args.find((a) => !a.startsWith("--"))?.trim().toLowerCase();

if (!email || args.includes("--help")) {
  console.log("Usage: reset-password <email> [--password-stdin]");
  console.log("Sets a new password for the account and signs out every device.");
  process.exit(args.includes("--help") ? 0 : 1);
}
if (!process.env.DATABASE_URL) fail("DATABASE_URL isn't set — run this inside the Bookplate container.");

let password;
if (fromStdin) {
  password = await readStdin();
} else {
  if (!process.stdin.isTTY) fail("No terminal to ask for the password — run it with `docker compose exec`, or pass --password-stdin.");
  password = await askHidden("New password: ");
  if ((await askHidden("Repeat it:    ")) !== password) fail("The passwords don't match. Nothing was changed.");
}
if (password.length < MIN_LENGTH) fail(`Use at least ${MIN_LENGTH} characters. Nothing was changed.`);
if (password.length > MAX_LENGTH) fail(`Use at most ${MAX_LENGTH} characters. Nothing was changed.`);

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  const { rows } = await db.query('SELECT id, email FROM "user" WHERE lower(email) = $1', [email]);
  if (rows.length === 0) fail(`There's no account for ${email}.`);
  const user = rows[0];

  await db.query("BEGIN");
  const updated = await db.query(
    "UPDATE account SET password = $1, updated_at = now() WHERE user_id = $2 AND provider_id = 'credential'",
    [await hashPassword(password), user.id]
  );
  if (updated.rowCount === 0) {
    await db.query("ROLLBACK");
    fail(`${user.email} doesn't sign in with a password, so there's nothing to reset.`);
  }
  const sessions = await db.query("DELETE FROM session WHERE user_id = $1", [user.id]);
  // A new password also lifts any wrong-password block on the account.
  await db.query("DELETE FROM auth_throttle WHERE key = $1", [`sign-in:${user.email.toLowerCase()}`]);
  await db.query("COMMIT");

  console.log(`✓ Password changed for ${user.email}.`);
  console.log(
    sessions.rowCount ? `  ${sessions.rowCount} device${sessions.rowCount === 1 ? " was" : "s were"} signed out.` : "  No devices were signed in."
  );
} catch (e) {
  await db.query("ROLLBACK").catch(() => {});
  fail(e instanceof Error ? e.message : String(e));
} finally {
  await db.end();
}
