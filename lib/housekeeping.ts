import { sql } from "drizzle-orm";
import { pruneThrottle } from "./authThrottle";
import { config } from "./config";
import { getDb } from "./db";
import { log } from "./log";

// Tidying that runs at startup and then every few hours. Safe to run on
// several app copies at once: each step is a single idempotent delete.

const EVERY_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
// How long a new account has to confirm its address before it's removed.
export const UNVERIFIED_DAYS = 7;

// Accounts that never confirmed their email address, and so never signed in
// or stored anything. Only where confirming is required (open registration
// with email); and anything with a book, word, note, progress entry, profile
// photo or session is kept regardless — e.g. accounts made before email was
// set up, which never had to confirm.
export async function removeUnverifiedAccounts(): Promise<number> {
  if (!config.requireEmailVerification) return 0;
  const rows = await getDb().execute(sql`
    DELETE FROM "user" u
    WHERE u.email_verified = false
      AND u.created_at < now() - ${sql.raw(`interval '${UNVERIFIED_DAYS} days'`)}
      AND u.image IS NULL
      AND NOT EXISTS (SELECT 1 FROM book WHERE user_id = u.id)
      AND NOT EXISTS (SELECT 1 FROM vocab_entry WHERE user_id = u.id)
      AND NOT EXISTS (SELECT 1 FROM note WHERE user_id = u.id)
      AND NOT EXISTS (SELECT 1 FROM reading_progress WHERE user_id = u.id)
      AND NOT EXISTS (SELECT 1 FROM session WHERE user_id = u.id)
    RETURNING u.id`);
  return rows.rows.length;
}

// Removes sessions and email-link tokens that ran out over a day ago (the
// margin covers clock and time-zone differences), and strips the IP address
// and browser string from sessions stored before sessions stopped keeping them.
export async function tidySessions(): Promise<{ expired: number; stripped: number }> {
  const db = getDb();
  const expired = await db.execute(sql`DELETE FROM session WHERE expires_at < now() - interval '1 day' RETURNING id`);
  await db.execute(sql`DELETE FROM verification WHERE expires_at < now() - interval '1 day'`);
  const stripped = await db.execute(sql`
    UPDATE session SET ip_address = NULL, user_agent = NULL
    WHERE ip_address IS NOT NULL OR user_agent IS NOT NULL
    RETURNING id`);
  return { expired: expired.rows.length, stripped: stripped.rows.length };
}

export async function runHousekeeping(): Promise<void> {
  try {
    const removed = await removeUnverifiedAccounts();
    if (removed) void log.info("housekeeping.unverified_removed", { accounts: removed, afterDays: UNVERIFIED_DAYS });
    await pruneThrottle(2 * DAY_MS); // the longest window: the daily email count
    const sessions = await tidySessions();
    if (sessions.expired || sessions.stripped) void log.info("housekeeping.sessions_tidied", sessions);
  } catch (e) {
    void log.error("housekeeping.failed", { error: e });
  }
}

export function startHousekeeping(): void {
  void runHousekeeping();
  setInterval(runHousekeeping, EVERY_MS).unref();
}
