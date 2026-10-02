import { CONTACT_EMAIL } from "./config";
import { log } from "./log";

// Paces requests to outside services that limit how often one address may
// call them. Every reader on this server shares its address, so the pace is
// per server, not per reader. (With several app copies, each paces itself.)
//
//   openlibrary    search and book data: 1 request a second, or 3 with a
//                  contact email in the User-Agent (CONTACT_EMAIL)
//   coversByIsbn   Open Library covers looked up by ISBN: 100 per 5 minutes
//   itunes         iTunes Search: roughly 20 a minute
const GAP_MS = {
  openlibrary: CONTACT_EMAIL ? 350 : 1000,
  coversByIsbn: 3000,
  itunes: 3000,
};

export type Lane = keyof typeof GAP_MS;

const nextFree: Record<Lane, number> = { openlibrary: 0, coversByIsbn: 0, itunes: 0 };

// Thrown when a lane is booked up for longer than the caller will wait.
export class BusyError extends Error {
  constructor(public retryAfterMs: number) {
    super("The book service is busy — try again in a moment.");
  }
}

// Waits for this lane's next free slot, or throws BusyError if that's more
// than `maxWaitMs` away (so requests don't pile up behind a long queue).
export async function pace(lane: Lane, maxWaitMs: number): Promise<void> {
  const now = Date.now();
  const slot = Math.max(now, nextFree[lane]);
  if (slot - now > maxWaitMs) {
    void log.info("outbound.busy", { lane, waitMs: slot - now });
    throw new BusyError(slot - now);
  }
  nextFree[lane] = slot + GAP_MS[lane];
  if (slot > now) await new Promise((r) => setTimeout(r, slot - now));
}

// fetch() for outside services, logged: failures, refusals and timeouts as
// warnings with the service, status and time taken; successes at debug
// level. Never the URL itself, which holds search terms and ISBNs.
export async function outboundFetch(service: string, url: string, init: RequestInit = {}): Promise<Response> {
  const started = Date.now();
  try {
    const res = await fetch(url, init);
    const ms = Date.now() - started;
    // 404 is an ordinary answer here ("no cover", "no such word").
    if (res.ok || res.status === 404) void log.debug("outbound.ok", { service, status: res.status, ms });
    else void log.warn("outbound.failed", { service, status: res.status, ms });
    return res;
  } catch (e) {
    void log.warn("outbound.failed", { service, ms: Date.now() - started, error: e });
    throw e;
  }
}
