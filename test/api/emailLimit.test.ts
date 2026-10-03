import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, dropDatabase } from "./db";
import { inbox, MAILPIT_URL, SMTP_PORT } from "./mailpit";

// The daily cap on all emails (EMAIL_LIMIT_PER_DAY), run directly against a
// fresh database and the test mail server.

const DB = `bookplate_email_limit_${process.pid}`;

describe("the daily email cap", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = await createDatabase(DB);
    process.env.SMTP_HOST = new URL(MAILPIT_URL).hostname;
    process.env.SMTP_PORT = String(SMTP_PORT);
    process.env.EMAIL_LIMIT_PER_DAY = "2";
    const { runMigrations } = await import("@/lib/db/migrate");
    await runMigrations();
  });
  afterAll(async () => {
    const { getDb } = await import("@/lib/db");
    await getDb().$client.end();
    await dropDatabase(DB);
  });

  it("sends up to the cap, then refuses for the rest of the day", async () => {
    const { DailyLimitError, sendEmail, testEmail } = await import("@/lib/email");
    const to = `cap-${process.pid}@example.com`;
    await sendEmail(testEmail(to));
    await sendEmail(testEmail(to));
    await expect(sendEmail(testEmail(to))).rejects.toBeInstanceOf(DailyLimitError);
    await expect(sendEmail(testEmail(to))).rejects.toThrow(/2 emails for today/);
    await new Promise((r) => setTimeout(r, 500));
    expect(await inbox(to)).toHaveLength(2); // nothing over the cap left the server
  });

  it("counts every kind of email together, under today's UTC date", async () => {
    const { getDb } = await import("@/lib/db");
    const today = new Date().toISOString().slice(0, 10);
    const { rows } = await getDb().$client.query("SELECT failures FROM auth_throttle WHERE key = $1", [`email-day:${today}`]);
    expect(rows).toEqual([{ failures: 4 }]); // 2 sent + 2 refused attempts
  });
});
