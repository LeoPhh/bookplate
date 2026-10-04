import { describe, expect, it } from "vitest";
import { emailBaseUrl, reader, Visitor } from "./client";

// The plain test server has LEGAL_DIR = test/fixtures/legal; the email
// server has none.

describe("privacy policy and terms", () => {
  it("are shown to anyone, signed in or not", async () => {
    const v = new Visitor();
    const privacy = await v.fetch("/privacy");
    expect(privacy.status).toBe(200);
    const html = await privacy.text();
    expect(html).toContain("Privacy policy");
    expect(html).toContain("Test privacy text");
    expect(html).toMatch(/<table>[\s\S]*Accounts[\s\S]*until deleted/); // Markdown tables work
    expect((await v.fetch("/terms")).status).toBe(200);
  });

  it("show raw HTML in the files as text, never run it", async () => {
    const html = await (await new Visitor().fetch("/privacy")).text();
    expect(html).not.toContain('<script>alert("raw html must not run")');
    expect(html).toContain("&lt;script&gt;");
  });

  it("are linked from sign-in, and agreed to on sign-up", async () => {
    await reader(); // until an account exists, /login sends visitors to /setup
    const login = await (await new Visitor().fetch("/login")).text();
    expect(login).toContain('href="/privacy"');
    expect(login).toContain('href="/terms"');
    const signup = await (await new Visitor().fetch("/signup")).text();
    expect(signup).toContain("By creating an account you agree to the");
  });

  it("don't exist on a server without them", async () => {
    await reader("Reader", emailBaseUrl());
    const v = new Visitor(undefined, emailBaseUrl());
    expect((await v.fetch("/privacy")).status).toBe(404);
    expect(await (await v.fetch("/login")).text()).not.toContain('href="/privacy"');
  });
});
