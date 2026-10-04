import { readFileSync } from "fs";
import path from "path";
import nodemailer, { type Transporter } from "nodemailer";
import { countUp } from "./authThrottle";
import { config } from "./config";
import { log } from "./log";

// Sending email over SMTP — only when SMTP_HOST is set (see lib/config.ts).
// Works with any provider: Gmail, Fastmail, a NAS mail server, Resend,
// Postmark, Scaleway Transactional Email…

let transport: Transporter | null = null;

function getTransport(): Transporter {
  transport ??= nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: config.email.user ? { user: config.email.user, pass: config.email.password } : undefined,
  });
  return transport;
}

export interface Email {
  to: string;
  replyTo?: string; // instead of SMTP_REPLY_TO
  subject: string;
  text: string;
  html: string;
}

// The logo travels inside each email (an inline attachment the HTML points
// at with cid:), not as a link: it shows for self-hosted servers nobody can
// reach from outside, in clients that block remote images, and opening an
// email tells no server anything.
export const LOGO_CID = "logo@bookplate";
let logo: Buffer | null | undefined;

function logoImage(): Buffer | null {
  if (logo === undefined) {
    try {
      logo = readFileSync(path.join(/* turbopackIgnore: true */ process.cwd(), "public/icons/icon-192.png"));
    } catch {
      logo = null; // sent without it
    }
  }
  return logo;
}

export class DailyLimitError extends Error {
  constructor(limit: number) {
    super(`This server has sent its ${limit.toLocaleString("en")} emails for today (EMAIL_LIMIT_PER_DAY); sending resumes at midnight UTC.`);
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Counts this email against today's cap (EMAIL_LIMIT_PER_DAY, all emails from
// the server together, kept in the database so it holds across restarts and
// app copies). Throws once the cap is reached — logged as an error, so the
// alerts notice.
async function countAgainstDailyLimit(): Promise<void> {
  const limit = config.email.dailyLimit;
  if (!limit) return;
  const today = new Date().toISOString().slice(0, 10); // UTC date
  // The count lives under today's date; the 2-day window only keeps it from
  // resetting before the date changes. Housekeeping clears old days.
  const sent = await countUp(`email-day:${today}`, 2 * DAY_MS);
  if (sent > limit) {
    void log.error("email.daily_limit_reached", { limit, attempt: sent });
    throw new DailyLimitError(limit);
  }
}

export async function sendEmail(email: Email): Promise<void> {
  if (!config.email.enabled) throw new Error("Email isn't set up on this server (SMTP_HOST is empty).");
  await countAgainstDailyLimit();
  const image = email.html.includes(`cid:${LOGO_CID}`) ? logoImage() : null;
  await getTransport().sendMail({
    from: config.email.from,
    ...(config.email.replyTo && { replyTo: config.email.replyTo }),
    ...email,
    attachments: image ? [{ filename: "bookplate.png", content: image, cid: LOGO_CID, contentType: "image/png" }] : [],
  });
}

// ── The look ─────────────────────────────────────────────────────────────
//
// The app's "press" style, in what email clients reliably render: tables and
// inline styles. Paper background, the masthead over a heavy black rule, a
// white card with a hard offset shadow, a vermilion eyebrow, a black button.
// No web fonts (they'd load from a third party whenever an email is opened):
// the heavy type falls back to Arial Black / Impact.

const C = { paper: "#f4f2ec", ink: "#111111", soft: "#6b6862", hair: "#d6d2c8", accent: "#ff3b1f", white: "#ffffff" };
const DISPLAY = "'Archivo Black','Arial Black',Impact,'Helvetica Neue',Arial,sans-serif";
const BODY = "-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

interface Message {
  subject: string;
  preview: string; // the line inbox lists show after the subject
  eyebrow: string;
  title: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  note?: string; // the small print under the button
  why: string; // footer: why this address got the email
  replyTo?: string; // where a reply goes, instead of SMTP_REPLY_TO
}

// "Questions? Just reply" only when a reply reaches the server's own inbox.
const replyInvite = (m: Message) => Boolean(config.email.replyTo) && !m.replyTo;

function html(m: Message): string {
  const site = new URL(config.publicUrl);
  const p = (text: string) =>
    `<p style="margin:0 0 16px;font-family:${BODY};font-size:16px;line-height:1.55;color:${C.ink}">${escape(text)}</p>`;
  const button = m.action
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 22px"><tr>` +
      `<td style="background:${C.ink};border:2px solid ${C.ink};box-shadow:4px 4px 0 ${C.accent}">` +
      `<a href="${escape(m.action.url)}" style="display:inline-block;padding:13px 22px;font-family:${BODY};font-size:15px;font-weight:700;color:${C.white};text-decoration:none">${escape(m.action.label)}</a>` +
      `</td></tr></table>` +
      `<p style="margin:0 0 6px;font-family:${BODY};font-size:12px;line-height:1.5;color:${C.soft}">Or paste this link into your browser:</p>` +
      `<p style="margin:0 0 18px;font-family:${BODY};font-size:12px;line-height:1.5;word-break:break-all"><a href="${escape(m.action.url)}" style="color:${C.ink}">${escape(m.action.url)}</a></p>`
    : "";
  const note = m.note
    ? `<p style="margin:0;padding-top:16px;border-top:1px solid ${C.hair};font-family:${BODY};font-size:13px;line-height:1.5;color:${C.soft}">${escape(m.note)}</p>`
    : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${escape(m.subject)}</title></head>
<body style="margin:0;padding:0;background:${C.paper}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.paper}">${escape(m.preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper}"><tr><td align="center" style="padding:32px 16px 40px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="padding:0 0 14px;border-bottom:3px solid ${C.ink}">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:middle;padding-right:10px"><img src="cid:${LOGO_CID}" width="52" height="52" alt="" style="display:block;border:0;border-radius:12px"></td>
<td style="vertical-align:middle;font-family:${DISPLAY};font-size:28px;font-weight:900;letter-spacing:-0.03em;color:${C.ink}">Bookplate</td>
</tr></table></td></tr>
<tr><td style="padding:28px 6px 6px 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.white};border:2px solid ${C.ink};box-shadow:6px 6px 0 ${C.ink}"><tr><td style="padding:30px 30px 26px">
<p style="margin:0 0 10px;font-family:${BODY};font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:${C.accent}">${escape(m.eyebrow)}</p>
<h1 style="margin:0 0 20px;font-family:${DISPLAY};font-size:30px;line-height:1.1;font-weight:900;letter-spacing:-0.03em;color:${C.ink}">${escape(m.title)}</h1>
${m.paragraphs.map(p).join("")}${button}${note}
</td></tr></table></td></tr>
<tr><td style="padding:22px 0 0;font-family:${BODY};font-size:12px;line-height:1.6;color:${C.soft}">
${replyInvite(m) ? `Questions? Just reply to this email.<br>` : ""}${escape(m.why)}<br><a href="${escape(site.origin)}" style="color:${C.soft}">${escape(site.host)}</a>
</td></tr>
</table></td></tr></table>
</body></html>`;
}

function text(m: Message): string {
  return [
    m.title,
    "",
    ...m.paragraphs.flatMap((p) => [p, ""]),
    ...(m.action ? [`${m.action.label}: ${m.action.url}`, ""] : []),
    ...(m.note ? [m.note, ""] : []),
    ...(replyInvite(m) ? ["Questions? Just reply to this email.", ""] : []),
    "— Bookplate",
    m.why,
    "",
  ].join("\n");
}

function build(to: string, m: Message): Email {
  return { to, subject: m.subject, text: text(m), html: html(m), ...(m.replyTo && { replyTo: m.replyTo }) };
}

// ── The emails ───────────────────────────────────────────────────────────

export function resetPasswordEmail(to: string, url: string): Email {
  return build(to, {
    subject: "Reset your Bookplate password",
    preview: "Choose a new password — the link works once and expires in an hour.",
    eyebrow: "Password reset",
    title: "Choose a new password",
    paragraphs: [
      "Someone asked to reset the password for your Bookplate account. If that was you, choose a new one below. The link works once and expires in an hour, and using it signs you out everywhere.",
    ],
    action: { label: "Choose a new password", url },
    note: "If it wasn’t you, ignore this email — your password stays the same.",
    why: "You’re receiving this because a password reset was requested for this address on Bookplate.",
  });
}

export function verifyEmail(to: string, url: string): Email {
  return build(to, {
    subject: "Confirm your email for Bookplate",
    preview: "One click to finish setting up your library.",
    eyebrow: "Welcome",
    title: "Confirm your email",
    paragraphs: [
      "Welcome to Bookplate! Confirm this is your email address to finish setting up your account — then your library is ready for its first book.",
    ],
    action: { label: "Confirm my email", url },
    note: "The link expires in an hour. If you didn’t sign up, ignore this email and no account will be activated.",
    why: "You’re receiving this because this address was used to create a Bookplate account.",
  });
}

export function testEmail(to: string): Email {
  return build(to, {
    subject: "Bookplate test email",
    preview: "Email is set up correctly on your Bookplate server.",
    eyebrow: "Test",
    title: "Email works",
    paragraphs: [
      "This is a test email from your Bookplate server. If you’re reading it, email is set up correctly: password resets and sign-up confirmations will reach people too.",
    ],
    why: "You’re receiving this because you sent a test email from Settings → Email.",
  });
}

// A message from the contact form (app/api/contact), to the server's own
// inbox (CONTACT_FORM_TO). Replying answers the person who wrote it.
export function contactEmail(to: string, from: { name: string; email: string }, message: string): Email {
  const who = from.name || from.email;
  return build(to, {
    subject: `Contact form: ${who}`,
    preview: message.slice(0, 120),
    eyebrow: "Contact form",
    title: `Message from ${who}`,
    paragraphs: [...message.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean), `— ${from.name ? `${from.name}, ` : ""}${from.email}`],
    why: "Sent through the contact form. Reply to this email to answer them.",
    replyTo: from.name ? `"${from.name.replace(/["\\]/g, "")}" <${from.email}>` : from.email,
  });
}
