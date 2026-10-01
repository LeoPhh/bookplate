import { spawnSync } from "child_process";
import path from "path";
import { describe, expect, it, inject } from "vitest";
import { reader, Visitor } from "./client";

// `docker compose exec bookplate reset-password you@example.com`, run here
// as `node scripts/reset-password.mjs` against the plain test server's database.

const SCRIPT = path.resolve(__dirname, "../../scripts/reset-password.mjs");

function resetPassword(email: string, password: string) {
  const env = { ...process.env, DATABASE_URL: inject("dbUrl") };
  return spawnSync(process.execPath, [SCRIPT, email, "--password-stdin"], { input: password, env, encoding: "utf8" });
}

const signIn = (email: string, password: string, ip?: string) =>
  new Visitor(ip).json("/api/auth/sign-in/email", "POST", { email, password });

describe("the reset-password command", () => {
  it("sets a password Bookplate accepts and signs every device out", async () => {
    const r = await reader();
    const run = resetPassword(r.email.toUpperCase(), "set-by-the-owner");
    expect(run.status).toBe(0);
    expect(run.stdout).toContain(`Password changed for ${r.email}`);
    expect(run.stdout).toContain("1 device was signed out");

    expect((await r.fetch("/api/books")).status).toBe(401);
    expect((await signIn(r.email, r.password)).status).toBe(401);
    expect((await signIn(r.email, "set-by-the-owner")).status).toBe(200); // same hashing as Better Auth
  });

  it("lifts a wrong-password block", async () => {
    const r = await reader();
    for (let i = 1; i <= 5; i++) expect((await signIn(r.email, "wrong-guess", `203.0.113.${100 + i}`)).status).toBe(401);
    expect((await signIn(r.email, r.password)).status).toBe(429);
    expect(resetPassword(r.email, "unlocked-password").status).toBe(0);
    expect((await signIn(r.email, "unlocked-password")).status).toBe(200);
  });

  it("refuses short passwords and unknown accounts, changing nothing", async () => {
    const r = await reader();
    const short = resetPassword(r.email, "short");
    expect(short.status).toBe(1);
    expect(short.stderr).toContain("at least 8");
    expect((await signIn(r.email, r.password)).status).toBe(200);

    const unknown = resetPassword("nobody@example.com", "long-enough-password");
    expect(unknown.status).toBe(1);
    expect(unknown.stderr).toContain("no account");
  });
});
