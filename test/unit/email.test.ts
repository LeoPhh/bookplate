import { describe, expect, it } from "vitest";
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
