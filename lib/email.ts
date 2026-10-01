import nodemailer, { type Transporter } from "nodemailer";
import { config } from "./config";

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
  subject: string;
  text: string;
  html: string;
}

export async function sendEmail(email: Email): Promise<void> {
  if (!config.email.enabled) throw new Error("Email isn't set up on this server (SMTP_HOST is empty).");
  await getTransport().sendMail({ from: config.email.from, ...email });
}

// ── The emails ───────────────────────────────────────────────────────────

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// A plain, readable layout that survives every mail client.
function layout(paragraphs: string[], action?: { label: string; url: string }): string {
  const body = paragraphs.map((p) => `<p style="margin:0 0 16px">${escape(p)}</p>`).join("");
  const button = action
    ? `<p style="margin:24px 0"><a href="${escape(action.url)}" style="background:#111;color:#fff;padding:12px 20px;text-decoration:none;font-weight:bold">${escape(action.label)}</a></p>` +
      `<p style="margin:0 0 16px;color:#6b6862;font-size:13px">Or paste this link into your browser:<br>${escape(action.url)}</p>`
    : "";
  return (
    `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111;max-width:520px">` +
    `<p style="margin:0 0 20px;font-weight:bold;font-size:18px">Bookplate</p>${body}${button}` +
    `<p style="margin:24px 0 0;color:#6b6862;font-size:13px">— Bookplate</p></div>`
  );
}

export function resetPasswordEmail(to: string, url: string): Email {
  const lines = [
    "Someone asked to reset the password for your Bookplate account. If that was you, choose a new password with the link below. It works once and expires in an hour.",
    "If it wasn't you, ignore this email — your password stays the same.",
  ];
  return {
    to,
    subject: "Reset your Bookplate password",
    text: `${lines[0]}\n\n${url}\n\n${lines[1]}\n\n— Bookplate\n`,
    html: layout(lines, { label: "Choose a new password", url }),
  };
}

export function verifyEmail(to: string, url: string): Email {
  const lines = [
    "Welcome to Bookplate! Confirm this is your email address to finish setting up your account. The link expires in an hour.",
    "If you didn't sign up, ignore this email and no account will be activated.",
  ];
  return {
    to,
    subject: "Confirm your email for Bookplate",
    text: `${lines[0]}\n\n${url}\n\n${lines[1]}\n\n— Bookplate\n`,
    html: layout(lines, { label: "Confirm my email", url }),
  };
}

export function testEmail(to: string): Email {
  const lines = ["This is a test email from your Bookplate server. If you're reading it, email is set up correctly."];
  return {
    to,
    subject: "Bookplate test email",
    text: `${lines[0]}\n\n— Bookplate\n`,
    html: layout(lines),
  };
}
