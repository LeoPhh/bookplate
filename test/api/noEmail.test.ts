import { describe, expect, it } from "vitest";
import { reader, Visitor } from "./client";

// The plain test server has no email set up, like most self-hosted servers.

describe("without email", () => {
  it("offers 'Forgot password?' with the command to reset it on the server", async () => {
    const v = new Visitor();
    await reader(); // the setup screen hands over to sign-in once an account exists
    expect(await (await v.fetch("/login")).text()).toContain("Forgot password?");
    const page = await (await v.fetch("/forgot-password")).text();
    expect(page).toContain("reset-password you@example.com");
    expect(page).not.toContain("Send reset link");
  });

  it("signs new accounts straight in, with no email to confirm", async () => {
    const r = await reader();
    expect((await r.fetch("/api/books")).status).toBe(200);
  });

  it("explains that test emails can't be sent", async () => {
    const r = await reader();
    const res = await r.fetch("/api/email/test", { method: "POST" });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/isn.t set up/);
  });

  it("explains an expired or used reset link", async () => {
    const page = await (await new Visitor().fetch("/reset-password?error=INVALID_TOKEN")).text();
    expect(page).toContain("expired or was already used");
  });
});
