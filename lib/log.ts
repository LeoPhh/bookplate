import { createHash } from "crypto";
import { config } from "./config";

// Structured logs: one JSON object per line on stdout, which Docker keeps and
// a log shipper (Alloy → Cockpit) can search. Every line has the time, level,
// an event name, the app version and — inside a request — the request ID
// that proxy.ts gives each request and sends back as X-Request-Id.
//
//   {"t":"…","level":"warn","event":"openlibrary.search_failed","v":"0.8.0","req":"7f3a…","status":503,"ms":812}
//
// Never log: passwords, cookies, session or reset tokens, links from emails,
// note or book contents, search terms, S3 keys. Name accounts by user ID, or
// by account() before there is one. Email addresses in messages are scrubbed.

export const REQUEST_ID_HEADER = "x-request-id";

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type Level = keyof typeof LEVELS;
type Fields = Record<string, unknown>;

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
export const scrub = (s: string) => s.replace(EMAIL, "[email]");

// A stable, non-reversible name for an account known only by its email
// address (e.g. a failed sign-in), so repeated attempts can be told apart.
export function account(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 12);
}

function clean(value: unknown, depth = 0): unknown {
  if (value instanceof Error) {
    const e = value as Error & { code?: unknown; digest?: unknown; cause?: unknown };
    return {
      name: e.name,
      message: scrub(e.message),
      ...(e.code !== undefined && { code: String(e.code) }),
      ...(e.digest !== undefined && { digest: String(e.digest) }),
      ...(e.stack && { stack: scrub(e.stack) }),
      ...(e.cause !== undefined && depth < 2 && { cause: clean(e.cause, depth + 1) }),
    };
  }
  if (typeof value === "string") return scrub(value);
  if (Array.isArray(value)) return depth < 3 ? value.map((v) => clean(v, depth + 1)) : "[…]";
  if (value && typeof value === "object") {
    if (depth >= 3) return "[…]";
    return Object.fromEntries(
      Object.entries(value as Fields)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, clean(v, depth + 1)])
    );
  }
  return value;
}

export function formatLine(level: Level, event: string, fields: Fields = {}): string {
  return JSON.stringify({
    t: new Date().toISOString(),
    level,
    event,
    v: config.version,
    ...(clean(fields) as Fields),
  });
}

// The current request's ID, or undefined outside a request (startup,
// housekeeping) or before proxy.ts has run.
async function currentRequestId(): Promise<string | undefined> {
  try {
    const { headers } = await import("next/headers");
    return (await headers()).get(REQUEST_ID_HEADER) ?? undefined;
  } catch {
    return undefined;
  }
}

async function write(level: Level, event: string, fields: Fields = {}): Promise<void> {
  if (LEVELS[level] < LEVELS[config.logLevel]) return;
  const req = "req" in fields ? fields.req : await currentRequestId();
  process.stdout.write(formatLine(level, event, { ...fields, req }) + "\n");
}

// Fire and forget (`void log.info(…)`), or await when the process is about to exit.
export const log = {
  debug: (event: string, fields?: Fields) => write("debug", event, fields),
  info: (event: string, fields?: Fields) => write("info", event, fields),
  warn: (event: string, fields?: Fields) => write("warn", event, fields),
  error: (event: string, fields?: Fields) => write("error", event, fields),
};
