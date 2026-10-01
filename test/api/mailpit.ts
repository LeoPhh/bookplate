// Reading the emails Bookplate sends, from Mailpit's API — a fake mail server
// with a web inbox (docker-compose.dev.yml; a service in CI).

export const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://localhost:8025";
export const SMTP_PORT = Number(process.env.MAILPIT_SMTP_PORT ?? 1025);

export interface Mail {
  subject: string;
  text: string;
  html: string;
}

interface Summary {
  ID: string;
  Subject: string;
}

async function search(to: string): Promise<Summary[]> {
  const res = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
  if (!res.ok) throw new Error(`Mailpit search failed: ${res.status}`);
  return ((await res.json()) as { messages: Summary[] }).messages;
}

// Every email sent to an address so far.
export async function inbox(to: string): Promise<Summary[]> {
  return search(to);
}

// Waits for the next email to `to` whose subject contains `subject`.
export async function waitForMail(to: string, subject: string, { after = 0, timeoutMs = 10_000 } = {}): Promise<Mail> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const matches = (await search(to)).filter((m) => m.Subject.includes(subject));
    if (matches.length > after) {
      const res = await fetch(`${MAILPIT_URL}/api/v1/message/${matches[0].ID}`); // newest first
      const m = (await res.json()) as { Subject: string; Text: string; HTML: string };
      return { subject: m.Subject, text: m.Text, html: m.HTML };
    }
    if (Date.now() > deadline) throw new Error(`No "${subject}" email arrived for ${to}`);
    await new Promise((r) => setTimeout(r, 150));
  }
}

// The first link in an email's text that starts with `prefix`.
export function linkIn(mail: Mail, prefix: string): string {
  const link = mail.text.split(/\s+/).find((w) => w.startsWith(prefix));
  if (!link) throw new Error(`No link starting with ${prefix} in:\n${mail.text}`);
  return link;
}
