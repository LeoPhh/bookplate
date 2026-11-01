import { DrizzleQueryError } from "drizzle-orm/errors";
import { PgPreparedQuery } from "drizzle-orm/pg-core/session";

// A failed query's error carries the values it was given: Drizzle adds them to
// its message and as `params`, Postgres repeats them in `detail` ("Failing row
// contains…"). Those can be book titles, notes or addresses, and Next.js prints
// every property of an error it catches, so they are taken out where the error
// is made, before anything can log it. What's left says which query and which
// constraint failed.

type PgError = Error & { code?: unknown; [field: string]: unknown };

function setMessage(e: Error, message: string) {
  if (e.stack) e.stack = e.stack.split(e.message).join(message);
  e.message = message;
}

export function removeValues(e: DrizzleQueryError): void {
  setMessage(e, `Failed query: ${e.query}`);
  e.params = [];
  const cause = e.cause as PgError | undefined;
  if (!cause) return;
  for (const field of ["detail", "where", "internalQuery"]) delete cause[field];
  // Data errors quote the value: `invalid input syntax for type integer: "x"`.
  if (String(cause.code).startsWith("22")) setMessage(cause, cause.message.split(":")[0]);
}

// Drizzle has no hook for this; every query it runs passes through this method.
// A test in test/api/logs.test.ts fails if an upgrade changes that.
export function removeValuesFromQueryErrors(): void {
  const proto = PgPreparedQuery.prototype as unknown as { queryWithCache: (...args: unknown[]) => Promise<unknown> };
  const run = proto.queryWithCache;
  proto.queryWithCache = async function (this: unknown, ...args: unknown[]) {
    try {
      return await run.apply(this, args);
    } catch (e) {
      if (e instanceof DrizzleQueryError) removeValues(e);
      throw e;
    }
  };
}
