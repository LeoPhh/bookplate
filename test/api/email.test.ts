import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import { describe, expect, inject, it } from "vitest";
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
    // Replies go to the support inbox (SMTP_REPLY_TO), and the email says so.
    expect(mail.replyTo).toEqual(["support@test.local"]);
    expect(mail.text).toContain("Questions? Just reply to this email.");
    const res = await r.fetch(linkIn(mail, `${emailBaseUrl()}/api/auth/verify-email`));
    expect([302, 307]).toContain(res.status);
    expect((await r.fetch("/api/books")).status).toBe(200);
    expect((await signIn(r.email, r.password)).status).toBe(200);
  });
});

describe("signing up with an address that already has an account", () => {
  const signUpAgain = (email: string) => new Visitor(undefined, emailBaseUrl()).signUp(email, "another-password-1");

  it("looks like any sign-up, and tells the confirmed owner by email", async () => {
    const r = await confirmedReader();
    const res = await signUpAgain(r.email);
    const fresh = await new Visitor(undefined, emailBaseUrl()).signUp(`${randomUUID()}@example.com`, "another-password-1");
    expect(res.status).toBe(fresh.status);
    const keys = async (x: Response) => Object.keys(((await x.json()) as { user: object }).user).sort();
    expect(await keys(res)).toEqual(await keys(fresh));

    const mail = await waitForMail(r.email, "You already have a Bookplate account");
    expect(linkIn(mail, `${emailBaseUrl()}/login`)).toBe(`${emailBaseUrl()}/login`);
    expect(mail.text).toContain("Your account and password stay the same.");
    expect(mail.html).toContain('src="cid:logo@bookplate"');
    expect(mail.inline).toContainEqual({ contentId: "logo@bookplate", contentType: "image/png" });

    // The account is untouched: the password typed at sign-up did nothing.
    expect((await signIn(r.email, "another-password-1")).status).toBe(401);
    expect((await signIn(r.email, r.password)).status).toBe(200);
  });

  it("sends an unconfirmed owner a fresh link instead, which works", async () => {
    const r = await reader("Waiting", emailBaseUrl());
    await waitForMail(r.email, "Confirm your email");
    expect((await signUpAgain(r.email)).status).toBe(200);

    const mail = await waitForMail(r.email, "Confirm your email", { after: 1 });
    const link = linkIn(mail, `${emailBaseUrl()}/api/auth/verify-email`);
    expect(link).toContain(`callbackURL=${encodeURIComponent("/login")}`);
    expect([302, 307]).toContain((await r.fetch(link)).status);
    expect((await signIn(r.email, r.password)).status).toBe(200);
    expect((await inbox(r.email)).filter((m) => m.Subject.includes("already have"))).toHaveLength(0);
  });

  it("sends at most 3 of these emails per address in a short time", async () => {
    const r = await confirmedReader();
    for (let i = 0; i < 5; i++) expect((await signUpAgain(r.email)).status).toBe(200);
    await waitForMail(r.email, "You already have a Bookplate account", { after: 2 });
    await new Promise((res) => setTimeout(res, 500)); // let any extra email arrive
    expect((await inbox(r.email)).filter((m) => m.Subject.includes("already have"))).toHaveLength(3);
  });

  it("is logged apart from real sign-ups, naming no made-up account", async () => {
    const r = await confirmedReader();
    const id = `test-${randomUUID()}`;
    const v = new Visitor(undefined, emailBaseUrl());
    await v.signUp(r.email, "another-password-1", "Reader", { ...(await v.signupChallenge()), "X-Request-Id": id });
    await waitForMail(r.email, "You already have a Bookplate account");
    const lines = readFileSync(inject("emailLog"), "utf8")
      .split("\n")
      .filter((l) => l.includes(id))
      .map((l) => JSON.parse(l) as { event: string; user?: string });
    expect(lines.map((l) => l.event)).toContain("auth.sign_up_existing");
    expect(lines.map((l) => l.event)).not.toContain("auth.sign_up");
    expect(lines.every((l) => !l.user)).toBe(true);
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

describe("an account that never confirmed its email", () => {
  // e.g. the owner's, made at /setup before email or open registration
  // existed: once confirmation is required, it can't sign in…
  it("is confirmed by resetting its password by email, and can sign in after", async () => {
    const r = await reader("Old", emailBaseUrl()); // signed up, never confirmed
    expect(((await (await signIn(r.email, r.password)).json()) as { code: string }).code).toBe("EMAIL_NOT_VERIFIED");

    await requestReset(r.email);
    const token = await tokenFrom(await resetLink(r.email));
    const newPassword = "fresh-password-2";
    const reset = await new Visitor(undefined, emailBaseUrl()).json("/api/auth/reset-password", "POST", { newPassword, token });
    expect(reset.status).toBe(200);

    // …but the reset link reached its inbox, which proves the address.
    expect((await signIn(r.email, newPassword)).status).toBe(200);
  });
});

