import { readFileSync } from "fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LOGO_CID, resetPasswordEmail, testEmail, verifyEmail } from "@/lib/email";

const url = 'https://books.example.com/api/auth/reset-password/abc?callbackURL=/reset-password&x="<b>"';

describe("emails", () => {
  const all = [resetPasswordEmail("r@example.com", url), verifyEmail("r@example.com", url), testEmail("r@example.com")];

  it("carry the logo inside the email, and load nothing from elsewhere", () => {
    for (const m of all) {
      expect(m.html).toContain(`src="cid:${LOGO_CID}"`);
      expect(m.html).not.toMatch(/<img[^>]+src="https?:/); // no remote images (tracking, blocked clients)
      expect(m.html).not.toMatch(/<link|@import|url\(/); // no web fonts or remote CSS
    }
  });

  it("show the logo file at half its size, so it's sharp on high-resolution screens", () => {
    // A missing file would send every email without a logo, silently.
    const png = readFileSync("public/email/bookplate-lockup.png");
    const [width, height] = [png.readUInt32BE(16), png.readUInt32BE(20)];
    const shown = all[0].html.match(/<img src="cid:[^"]+" width="(\d+)" height="(\d+)"/);
    expect([Number(shown?.[1]) * 2, Number(shown?.[2]) * 2]).toEqual([width, height]);
  });

  it("escape the link, and show it as a button and as text", () => {
    const m = resetPasswordEmail("r@example.com", url);
    expect(m.html).not.toContain('"<b>"');
    expect(m.html).toContain("&quot;&lt;b&gt;&quot;");
    expect(m.html.match(/href="https:\/\/books\.example\.com\/api\/auth\/reset-password/g)).toHaveLength(2);
    expect(m.text).toContain(url);
    expect(m.text).toContain("Choose a new password:");
  });

  it("say why the address got the email, and which server sent it", () => {
    for (const m of all) {
      expect(m.text).toContain("You’re receiving this because");
      expect(m.html).toMatch(/You’re receiving this because/);
    }
  });

  it("have a plain-text version without HTML", () => {
    const plain = "https://books.example.com/confirm?token=abc";
    for (const m of [resetPasswordEmail("r@example.com", plain), verifyEmail("r@example.com", plain), testEmail("r@example.com")]) {
      expect(m.text).not.toMatch(/<[a-z]/i);
    }
  });
});

describe("SMTP_REPLY_TO", () => {
  const load = async (value?: string) => {
    vi.resetModules();
    if (value === undefined) delete process.env.SMTP_REPLY_TO;
    else process.env.SMTP_REPLY_TO = value;
    return (await import("@/lib/config")).config.email.replyTo;
  };
  afterEach(() => delete process.env.SMTP_REPLY_TO);

  it("accepts an address, with or without a name", async () => {
    expect(await load("support@example.com")).toBe("support@example.com");
    expect(await load("Bookplate Support <support@example.com>")).toBe("Bookplate Support <support@example.com>");
    expect(await load()).toBe("");
  });

  it("refuses something that isn't an address", async () => {
    await expect(load("support")).rejects.toThrow(/must be an email address/);
  });

  it("only invites replies when there's somewhere for them to go", async () => {
    await load();
    expect((await import("@/lib/email")).testEmail("r@example.com").text).not.toContain("Just reply");
    await load("support@example.com");
    expect((await import("@/lib/email")).testEmail("r@example.com").text).toContain("Just reply");
  });
});
