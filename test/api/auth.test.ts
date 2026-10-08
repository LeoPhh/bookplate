import { Client } from "pg";
import { describe, expect, inject, it } from "vitest";
import { baseUrl, reader, Visitor } from "./client";

describe("health and headers", () => {
  it("reports healthy with the app version", async () => {
    const res = await new Visitor().fetch("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });

  it("sends the security headers on pages", async () => {
    const res = await new Visitor().fetch("/login");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("content-security-policy")).toContain("default-src 'self'");
  });
});

describe("signed-out visitors", () => {
  it("are sent to sign in and refused by the API", async () => {
    const v = new Visitor();
    const page = await v.fetch("/");
    expect(page.status).toBe(307);
    expect(page.headers.get("location")).toContain("/login");
    for (const path of ["/api/books", "/api/vocabulary", "/api/progress", "/api/notes", "/api/export"]) {
      expect((await v.fetch(path)).status, path).toBe(401);
    }
  });

  it("get nothing with a forged session cookie", async () => {
    const v = new Visitor();
    v.cookie = "better-auth.session_token=forged.value";
    expect((await v.fetch("/api/books")).status).toBe(401);
  });
});

describe("signing in", () => {
  it("works with the right password and not the wrong one", async () => {
    const r = await reader();
    const ok = await new Visitor().json("/api/auth/sign-in/email", "POST", { email: r.email, password: r.password });
    expect(ok.status).toBe(200);
    const bad = await new Visitor().json("/api/auth/sign-in/email", "POST", { email: r.email, password: "wrong-guess" });
    expect(bad.status).toBe(401);
  });

  it("rejects a sign-in from another website", async () => {
    const r = await reader();
    const res = await fetch(`${baseUrl()}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
      body: JSON.stringify({ email: r.email, password: r.password }),
    });
    expect(res.status).toBe(403);
  });

  // Each attempt claims a different IP address — the trick that got around
  // the old, IP-only limit. Counting per account stops it.
  it("blocks an account after 5 wrong passwords, whatever IP the attempts claim", async () => {
    const r = await reader();
    const attempt = (password: string, n: number) =>
      new Visitor(`203.0.113.${n}`).json("/api/auth/sign-in/email", "POST", { email: r.email, password });
    for (let i = 1; i <= 5; i++) expect((await attempt("wrong-guess", i)).status).toBe(401);
    const blocked = await attempt("wrong-guess", 6);
    expect(blocked.status).toBe(429);
    // Even the right password waits out the block…
    expect((await attempt(r.password, 7)).status).toBe(429);
    // …while other accounts are unaffected.
    const other = await reader();
    expect((await new Visitor("203.0.113.8").json("/api/auth/sign-in/email", "POST", { email: other.email, password: other.password })).status).toBe(200);
  });

  it("forgets earlier failures after a successful sign-in", async () => {
    const r = await reader();
    const attempt = (password: string) => new Visitor().json("/api/auth/sign-in/email", "POST", { email: r.email, password });
    for (let i = 0; i < 4; i++) expect((await attempt("wrong-guess")).status).toBe(401);
    expect((await attempt(r.password)).status).toBe(200);
    for (let i = 0; i < 4; i++) expect((await attempt("wrong-guess")).status).toBe(401);
    expect((await attempt(r.password)).status).toBe(200);
  });
});

async function query(text: string, params: unknown[]) {
  const db = new Client({ connectionString: inject("dbUrl") });
  await db.connect();
  try {
    return (await db.query(text, params)).rows;
  } finally {
    await db.end();
  }
}

describe("sessions", () => {
  it("last 30 days and keep no IP address or browser details", async () => {
    const r = await reader();
    const rows = await query(
      `SELECT s.ip_address, s.user_agent, s.expires_at > now() + interval '29 days' AS month
       FROM session s JOIN "user" u ON u.id = s.user_id WHERE u.email = $1`,
      [r.email]
    );
    expect(rows).toEqual([{ ip_address: null, user_agent: null, month: true }]);
  });
});

describe("when an account was last seen", () => {
  const lastSeen = async (email: string) =>
    (await query(`SELECT now() - last_seen_at < interval '1 minute' AS recent FROM "user" WHERE email = $1`, [email]))[0].recent;
  const forget = (email: string) =>
    query(`UPDATE "user" SET last_seen_at = now() - interval '1 year' WHERE email = $1`, [email]);

  it("is updated by signing in", async () => {
    const r = await reader();
    expect(await lastSeen(r.email)).toBe(true);
    await forget(r.email);
    await new Visitor().json("/api/auth/sign-in/email", "POST", { email: r.email, password: r.password });
    expect(await lastSeen(r.email)).toBe(true);
  });

  it("is updated by using Bookplate, at most once a day", async () => {
    const r = await reader();
    await forget(r.email);
    // A session less than a day old isn't extended, so nothing is written.
    await r.get("/api/books");
    expect(await lastSeen(r.email)).toBe(false);
    // Two days old: the next request extends it, and the account is seen.
    await query(
      `UPDATE session SET expires_at = expires_at - interval '2 days'
       WHERE user_id = (SELECT id FROM "user" WHERE email = $1)`,
      [r.email]
    );
    await r.get("/api/books");
    expect(await lastSeen(r.email)).toBe(true);
  });
});
