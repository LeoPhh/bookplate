import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "./db";

// Limits wrong-password attempts per account rather than per IP address.
//
// IP-based limits can be dodged: a visitor reaching Bookplate directly can
// send a made-up X-Forwarded-For header with every request, and the server
// believes it. Counting failures against the account itself stops password
// guessing whatever address a request claims to come from. The count lives
// in the database, so it holds across restarts and several app copies.

export const MAX_FAILURES = 5;
export const WINDOW_MS = 15 * 60 * 1000;

const { authThrottle } = schema;

// All time arithmetic happens in the database, against its own clock: mixing
// JavaScript dates with a timezone-less column skews the window by the
// server's UTC offset.
const interval = (ms: number) => sql.raw(`interval '${Math.round(ms / 1000)} seconds'`);

// Minutes until the key can be tried again, or 0 when it isn't blocked.
// `max` is how many attempts the window allows (5 wrong passwords by default).
export async function throttleWait(key: string, max = MAX_FAILURES, windowMs = WINDOW_MS): Promise<number> {
  const WINDOW = interval(windowMs);
  const [row] = await getDb()
    .select({
      failures: authThrottle.failures,
      secondsLeft: sql<number>`extract(epoch from (${authThrottle.windowStart} + ${WINDOW} - localtimestamp))`,
    })
    .from(authThrottle)
    .where(eq(authThrottle.key, key));
  if (!row || row.failures < max) return 0;
  const left = Number(row.secondsLeft);
  return left > 0 ? Math.ceil(left / 60) : 0;
}

// Counts a failure; a failure after the window has passed starts a new one.
export async function recordFailure(key: string, windowMs = WINDOW_MS): Promise<void> {
  await countUp(key, windowMs);
}

// Adds one to `key`'s count and returns the new count, in one atomic step —
// concurrent callers each get their own number. A count older than the window
// starts again at 1.
export async function countUp(key: string, windowMs = WINDOW_MS): Promise<number> {
  const WINDOW = interval(windowMs);
  const expired = sql`${authThrottle.windowStart} < localtimestamp - ${WINDOW}`;
  const [row] = await getDb()
    .insert(authThrottle)
    .values({ key, failures: 1, windowStart: sql`localtimestamp` })
    .onConflictDoUpdate({
      target: authThrottle.key,
      set: {
        failures: sql`CASE WHEN ${expired} THEN 1 ELSE ${authThrottle.failures} + 1 END`,
        windowStart: sql`CASE WHEN ${expired} THEN localtimestamp ELSE ${authThrottle.windowStart} END`,
      },
    })
    .returning({ count: authThrottle.failures });
  return row.count;
}

export async function clearThrottle(key: string): Promise<void> {
  await getDb().delete(authThrottle).where(eq(authThrottle.key, key));
}

// Marks `key` as used for `windowMs`. True the first time; false while it's
// still marked, even when two requests race for it.
export async function claimOnce(key: string, windowMs: number): Promise<boolean> {
  const rows = await getDb()
    .insert(authThrottle)
    .values({ key, failures: 1, windowStart: sql`localtimestamp` })
    .onConflictDoUpdate({
      target: authThrottle.key,
      set: { failures: 1, windowStart: sql`localtimestamp` },
      setWhere: sql`${authThrottle.windowStart} < localtimestamp - ${interval(windowMs)}`,
    })
    .returning({ key: authThrottle.key });
  return rows.length > 0;
}

// Drops entries whose window ended long ago (run now and then; see lib/housekeeping.ts).
export async function pruneThrottle(olderThanMs: number): Promise<void> {
  await getDb().delete(authThrottle).where(sql`${authThrottle.windowStart} < localtimestamp - ${interval(olderThanMs)}`);
}
