import { describe, expect, it } from "vitest";
import { confirmedReader, emailBaseUrl, reader, Visitor } from "./client";
import { inbox, linkIn, waitForMail } from "./mailpit";

// Runs against the server with email (Mailpit) and open registration, where
// new accounts must confirm their address.

const signIn = (email: string, password: string, ip?: string) =>
  new Visitor(ip, emailBaseUrl()).json("/api/auth/sign-in/email", "POST", { email, password });

const requestReset = (email: string, ip?: string) =>
  new Visitor(ip, emailBaseUrl()).json("/api/auth/request-password-reset", "POST", { email, redirectTo: "/reset-password" });

async function resetLink(email: string): Promise<string> {
  return linkIn(await waitForMail(email, "Reset your Bookplate password"), `${emailBaseUrl()}/api/auth/reset-password/`);
}

// Following an emailed reset link: Bookplate checks it and sends the browser
// on to /reset-password?token=… (or ?error=… when it's no good).
async function tokenFrom(link: string): Promise<string | null> {
  const res = await fetch(link, { redirect: "manual" });
  return new URL(res.headers.get("location") ?? "", emailBaseUrl()).searchParams.get("token");
}

describe("confirming a new account's email", () => {
  it("is required before signing in, and the emailed link signs you in", async () => {
    const r = await reader("New", emailBaseUrl());
    expect((await r.fetch("/api/books")).status).toBe(401); // signed up, not signed in

    const early = await signIn(r.email, r.password);
    expect(early.status).toBe(403);
    expect(((await early.json()) as { code: string }).code).toBe("EMAIL_NOT_VERIFIED");

    const mail = await waitForMail(r.email, "Confirm your email");
    expect(mail.text).toContain("expires in an hour");
    // Styled HTML with the logo carried inside the email, not linked.
    expect(mail.html).toContain('src="cid:logo@bookplate"');
    expect(mail.inline).toContainEqual({ contentId: "logo@bookplate", contentType: "image/png" });
    const res = await r.fetch(linkIn(mail, `${emailBaseUrl()}/api/auth/verify-email`));
    expect([302, 307]).toContain(res.status);
    expect((await r.fetch("/api/books")).status).toBe(200);
    expect((await signIn(r.email, r.password)).status).toBe(200);
  });
});

describe("resetting a forgotten password by email", () => {
  it("works once, replaces the old password and signs every device out", async () => {
    const r = await confirmedReader();
    const res = await requestReset(r.email);
    expect(res.status).toBe(200);

    const link = await resetLink(r.email);
    const token = await tokenFrom(link);
    expect(token).toBeTruthy();

    const reset = await new Visitor(undefined, emailBaseUrl()).json("/api/auth/reset-password", "POST", {
      newPassword: "brand-new-password",
      token,
    });
    expect(reset.status).toBe(200);

    expect((await r.fetch("/api/books")).status).toBe(401); // old session ended
    expect((await signIn(r.email, r.password)).status).toBe(401);
    expect((await signIn(r.email, "brand-new-password")).status).toBe(200);

    // The link only works once.
    const again = await new Visitor(undefined, emailBaseUrl()).json("/api/auth/reset-password", "POST", {
      newPassword: "another-password-1",
      token,
    });
    expect(again.status).toBe(400);
    expect(await tokenFrom(link)).toBeNull();
  });

  it("gives nothing away about which addresses have accounts", async () => {
    const r = await confirmedReader();
    const known = await requestReset(r.email);
    const unknown = await requestReset(`nobody-${Date.now()}@example.com`);
    expect(unknown.status).toBe(known.status);
    expect(await unknown.json()).toEqual(await known.json());
    await waitForMail(r.email, "Reset your Bookplate password");
    expect(await inbox(`nobody-${Date.now()}@example.com`)).toHaveLength(0);
  });

  it("sends at most 3 reset emails per address in a short time", async () => {
    const r = await confirmedReader();
    for (let i = 1; i <= 5; i++) expect((await requestReset(r.email, `192.0.2.${i}`)).status).toBe(200);
    await waitForMail(r.email, "Reset your Bookplate password", { after: 2 });
    await new Promise((res) => setTimeout(res, 500)); // let any extra email arrive
    const resets = (await inbox(r.email)).filter((m) => m.Subject.includes("Reset"));
    expect(resets).toHaveLength(3);
  });

  it("lifts a wrong-password block", async () => {
    const r = await confirmedReader();
    for (let i = 1; i <= 5; i++) expect((await signIn(r.email, "wrong-guess", `198.51.100.${i}`)).status).toBe(401);
    expect((await signIn(r.email, r.password)).status).toBe(429);

    await requestReset(r.email);
    const token = await tokenFrom(await resetLink(r.email));
    await new Visitor(undefined, emailBaseUrl()).json("/api/auth/reset-password", "POST", { newPassword: "fresh-password-1", token });
    expect((await signIn(r.email, "fresh-password-1")).status).toBe(200);
  });
});

describe("the Settings test email", () => {
  it("is sent to the signed-in reader", async () => {
    const r = await confirmedReader();
    const res = await r.fetch("/api/email/test", { method: "POST" });
    expect(res.status).toBe(200);
    const mail = await waitForMail(r.email, "Bookplate test email");
    expect(mail.text).toContain("email is set up correctly");
    expect((await new Visitor(undefined, emailBaseUrl()).fetch("/api/email/test", { method: "POST" })).status).toBe(401);
  });
});
