import { describe, expect, it } from "vitest";
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
