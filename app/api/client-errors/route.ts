import { getSession } from "@/lib/auth";
import { createCache } from "@/lib/cache";
import { clientIp } from "@/lib/clientIp";
import { log } from "@/lib/log";

// Errors from people's browsers (components/ErrorReporter.tsx), so a button
// that "does nothing" leaves a trace next to the server's own logs. Open to
// signed-out visitors too (the sign-in pages can break), so it's kept small:
// 8 KB per report, 20 reports per address per 10 minutes.

const MAX_BYTES = 8 * 1024;
const PER_WINDOW = 20;
const seen = createCache<number>(10 * 60 * 1000, 5_000);

const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);

export async function POST(request: Request) {
  const ip = clientIp(request.headers);
  const count = (seen.get(ip) ?? 0) + 1;
  if (count > PER_WINDOW) return new Response(null, { status: 429 });
  seen.set(ip, count);

  const raw = await request.text();
  if (raw.length > MAX_BYTES) return new Response(null, { status: 413 });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }
  const session = await getSession().catch(() => null);
  void log.warn("browser.error", {
    user: session?.user.id,
    kind: text(body.kind, 40),
    message: text(body.message, 500),
    stack: text(body.stack, 4000),
    // The page, without its query string (which can hold search terms).
    page: text(body.page, 200)?.split("?")[0],
    digest: text(body.digest, 40),
    userAgent: request.headers.get("user-agent")?.slice(0, 200),
  });
  return new Response(null, { status: 204 });
}
