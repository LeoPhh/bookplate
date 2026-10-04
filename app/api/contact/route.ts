import { countUp } from "@/lib/authThrottle";
import { checkChallenge, newChallenge } from "@/lib/botCheck";
import { clientIp } from "@/lib/clientIp";
import { config } from "@/lib/config";
import { contactEmail, DailyLimitError, sendEmail } from "@/lib/email";
import { log } from "@/lib/log";

// A contact form's back end: a website on the same domain (e.g. a landing
// page; Caddy sends /api/contact here) posts a message, and it's emailed to
// CONTACT_FORM_TO with the sender as Reply-To. Open to anyone, so: an
// invisible proof-of-work check (lib/botCheck.ts, as for sign-ups), a few
// messages per address per hour, the server's daily email cap, and nothing
// of the message itself in the logs.
//
//   GET  → a puzzle for the browser to solve
//   POST { name?, email, message, check } → 200 { ok: true }

const MAX_BYTES = 16 * 1024;
const MAX_MESSAGE = 5_000;
const PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;
const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

const enabled = () => Boolean(config.contactTo && config.email.enabled);
const fail = (status: number, error: string) => Response.json({ error }, { status });

export async function GET() {
  if (!enabled()) return fail(404, "There's no contact form on this server.");
  return Response.json(await newChallenge(), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!enabled()) return fail(404, "There's no contact form on this server.");
  const ip = clientIp(request.headers);

  const raw = await request.text();
  if (raw.length > MAX_BYTES) return fail(413, "That message is too long.");
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail(400, "That didn't arrive properly — try again.");
  }
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const name = str(body.name).replace(/\s+/g, " ").slice(0, 100);
  const email = str(body.email);
  const message = str(body.message);
  if (!EMAIL.test(email) || email.length > 254) return fail(400, "Enter an email address we can reply to.");
  if (!message) return fail(400, "Write a message first.");
  if (message.length > MAX_MESSAGE) return fail(400, `Keep it under ${MAX_MESSAGE.toLocaleString("en")} characters.`);

  const failed = await checkChallenge(typeof body.check === "string" ? body.check : null);
  if (failed) {
    void log.warn("contact.bot_check_failed", { reason: failed, ip });
    return fail(403, "The spam check didn't go through — reload the page and try again.");
  }
  if ((await countUp(`contact:${ip}`, HOUR_MS)) > PER_HOUR) {
    void log.warn("contact.limited", { ip });
    return fail(429, "That's a lot of messages — try again in an hour, or email us directly.");
  }

  try {
    await sendEmail(contactEmail(config.contactTo, { name, email }, message));
  } catch (e) {
    if (!(e instanceof DailyLimitError)) void log.error("contact.send_failed", { error: e });
    return fail(503, "Your message couldn't be sent just now — try again later, or email us directly.");
  }
  void log.info("contact.sent", { ip });
  return Response.json({ ok: true });
}
