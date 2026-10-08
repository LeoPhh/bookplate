import { randomUUID } from "crypto";
import { Client } from "pg";
import { describe, expect, inject, it } from "vitest";
import { confirmedReader, emailBaseUrl, limitedBaseUrl, reader, Visitor } from "./client";

// The plain and email servers offer a newsletter (NEWSLETTER=true); the
// limited one doesn't.

async function consentOf(email: string, dbUrl = inject("dbUrl")): Promise<Date | null> {
  const db = new Client({ connectionString: dbUrl });
  await db.connect();
  try {
    const { rows } = await db.query('SELECT newsletter_consent_at AS at FROM "user" WHERE email = $1', [email]);
    return rows[0].at;
  } finally {
    await db.end();
  }
}

// Signs up the way the sign-up form does, with the tick box's value.
async function signUp(v: Visitor, email: string, newsletter: unknown): Promise<Response> {
  return v.fetch("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await v.signupChallenge()) },
    body: JSON.stringify({ name: "Reader", email, password: "a-long-password-1", callbackURL: "/login", newsletter }),
  });
}

describe("the newsletter at sign-up", () => {
  it("subscribes readers who tick the box, and nobody else", async () => {
    const yes = `${randomUUID()}@example.com`;
    const no = `${randomUUID()}@example.com`;
    const odd = `${randomUUID()}@example.com`;
    expect((await signUp(new Visitor(), yes, true)).status).toBe(200);
    expect((await signUp(new Visitor(), no, false)).status).toBe(200);
    expect((await signUp(new Visitor(), odd, "yes")).status).toBe(200);
    expect(await consentOf(yes)).toBeInstanceOf(Date);
    expect(await consentOf(no)).toBeNull();
    expect(await consentOf(odd)).toBeNull();
    // Accounts made without the box at all (as before this feature) are off.
    expect(await consentOf((await reader()).email)).toBeNull();
  });

  it("shows the box on the sign-up page only where there's a newsletter", async () => {
    expect(await (await new Visitor().fetch("/signup")).text()).toContain("Email me the occasional");
    expect(await (await new Visitor(undefined, limitedBaseUrl()).fetch("/signup")).text()).not.toContain("Email me the occasional");
  });

  it("can't be switched on for someone else's account by signing up with their address", async () => {
    const owner = await confirmedReader();
    // The email server answers as if it worked, so it gives nothing away…
    expect((await signUp(new Visitor(undefined, emailBaseUrl()), owner.email, true)).status).toBe(200);
    // …but the real account is untouched.
    expect(await consentOf(owner.email, inject("emailDbUrl"))).toBeNull();
  });
});

describe("the newsletter in Settings", () => {
  it("switches on and off, keeping when the reader first agreed", async () => {
    const r = await reader();
    expect(await (await r.fetch("/settings")).text()).toMatch(/<input type="checkbox"(?![^>]*checked)[^>]*\/?><span>Email me the occasional/);

    expect(await (await r.json("/api/account", "PATCH", { newsletter: true })).json()).toEqual({ newsletter: true });
    const first = await consentOf(r.email);
    expect(first).toBeInstanceOf(Date);
    expect(await (await r.fetch("/settings")).text()).toMatch(/<input type="checkbox"[^>]*checked=""/);

    await r.json("/api/account", "PATCH", { newsletter: true });
    expect(await consentOf(r.email)).toEqual(first);

    expect((await r.json("/api/account", "PATCH", { newsletter: false })).status).toBe(200);
    expect(await consentOf(r.email)).toBeNull();
  });

  it("accepts only true or false, from a signed-in reader", async () => {
    const r = await reader();
    expect((await r.json("/api/account", "PATCH", { newsletter: "yes" })).status).toBe(400);
    expect((await r.json("/api/account", "PATCH", {})).status).toBe(400);
    expect((await new Visitor().json("/api/account", "PATCH", { newsletter: true })).status).toBe(401);
  });

  it("isn't there on a server without a newsletter", async () => {
    const r = await reader("Reader", limitedBaseUrl());
    expect((await r.json("/api/account", "PATCH", { newsletter: true })).status).toBe(404);
    expect(await (await r.fetch("/settings")).text()).not.toContain("Newsletter");
  });
});
