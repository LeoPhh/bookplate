import { readFileSync } from "fs";
import { randomUUID } from "crypto";
import { describe, expect, inject, it } from "vitest";
import { book, confirmedReader, emailBaseUrl, jpeg, reader, Visitor } from "./client";
import { linkIn, waitForMail } from "./mailpit";

// The servers' own output (see setup.ts): JSON lines from lib/log.ts, plus
// Next.js's plain-text banner and error copies.

type Line = Record<string, unknown> & { event?: string; level?: string; req?: string };

const lines = (file: string): Line[] =>
  readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l.startsWith("{"))
    .map((l) => JSON.parse(l));

// Log lines are written just after the response; wait for one to appear.
async function waitForLine(file: string, match: (l: Line) => boolean): Promise<Line> {
  const deadline = Date.now() + 5_000;
  for (;;) {
    const found = lines(file).find(match);
    if (found) return found;
    if (Date.now() > deadline) throw new Error("No matching log line");
    await new Promise((r) => setTimeout(r, 100));
  }
}

describe("request IDs", () => {
  it("are given to every request and sent back", async () => {
    const res = await new Visitor().fetch("/api/health");
    expect(res.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("keep a proxy's ID, but not a malformed one", async () => {
    const id = `caddy-${randomUUID()}`;
    const kept = await new Visitor().fetch("/api/health", { headers: { "X-Request-Id": id } });
    expect(kept.headers.get("x-request-id")).toBe(id);
    const replaced = await new Visitor().fetch("/api/health", { headers: { "X-Request-Id": "<script>" } });
    expect(replaced.headers.get("x-request-id")).not.toBe("<script>");
  });

  it("tie a request to the log lines it caused", async () => {
    const id = `test-${randomUUID()}`;
    const v = new Visitor();
    const res = await v.signUp(`${randomUUID()}@example.com`, "a-long-password-1", "Reader", {
      ...(await v.signupChallenge()),
      "X-Request-Id": id,
    });
    expect(res.status).toBe(200);
    const line = await waitForLine(inject("plainLog"), (l) => l.req === id && l.event === "auth.sign_up");
    expect(line).toMatchObject({ level: "info", user: expect.any(String), v: expect.any(String) });
  });
});

describe("server errors", () => {
  it("are logged with the route, the request ID and a stack trace", async () => {
    const r = await reader();
    // Not a form: the upload route can't parse it and throws.
    const res = await r.fetch("/api/covers", { method: "POST", headers: { "Content-Type": "text/plain" }, body: "x" });
    expect(res.status).toBe(500);
    const id = res.headers.get("x-request-id");
    const line = await waitForLine(inject("plainLog"), (l) => l.req === id && l.event === "request.failed");
    expect(line).toMatchObject({ level: "error", route: "/api/covers", method: "POST" });
    expect((line.error as { stack?: string }).stack).toBeTruthy();
  });
});

describe("browser error reports", () => {
  it("are logged without the page's query string", async () => {
    const message = `TypeError: test-${randomUUID()}`;
    const res = await new Visitor().json("/api/client-errors", "POST", {
      kind: "error",
      message,
      stack: "at Library (page.tsx:1)",
      page: "/books/b1?q=private+search",
    });
    expect(res.status).toBe(204);
    const line = await waitForLine(inject("plainLog"), (l) => l.message === message);
    expect(line).toMatchObject({ event: "browser.error", level: "warn", page: "/books/b1" });
  });

  it("refuse oversized reports", async () => {
    const res = await new Visitor().json("/api/client-errors", "POST", { message: "x".repeat(10_000) });
    expect(res.status).toBe(413);
  });
});

describe("what never reaches the logs", () => {
  it("keeps passwords, tokens, cookies and email addresses out", async () => {
    // Plain server: sign up, a wrong password, upload, import, delete.
    const r = await reader();
    await new Visitor().json("/api/auth/sign-in/email", "POST", { email: r.email, password: "wrong-password-123" });
    await r.json("/api/books/b1", "PUT", book("b1", { title: "A Secret Title" }));
    await r.upload("/api/covers", { file: jpeg(), id: "b1" });
    await r.upload("/api/import", { file: new Blob(["not a zip"]) });
    await r.json("/api/account", "DELETE", { password: r.password });
    await waitForLine(inject("plainLog"), (l) => l.event === "account.deleted");

    // Email server: confirm an address, then reset the password by email.
    const e = await confirmedReader();
    await new Visitor(undefined, emailBaseUrl()).json("/api/auth/request-password-reset", "POST", {
      email: e.email,
      redirectTo: "/reset-password",
    });
    const link = linkIn(await waitForMail(e.email, "Reset your Bookplate password"), `${emailBaseUrl()}/api/auth/reset-password/`);
    const token = new URL(
      (await fetch(link, { redirect: "manual" })).headers.get("location") ?? "",
      emailBaseUrl()
    ).searchParams.get("token")!;
    const newPassword = `new-${randomUUID()}`;
    await new Visitor(undefined, emailBaseUrl()).json("/api/auth/reset-password", "POST", { newPassword, token });
    await waitForLine(inject("emailLog"), (l) => l.event === "auth.password_reset");

    const all = readFileSync(inject("plainLog"), "utf8") + readFileSync(inject("emailLog"), "utf8");
    const secrets = {
      "a password": [r.password, "wrong-password-123", e.password, newPassword],
      "an email address": [r.email, e.email],
      "a session cookie": [r.cookie.split("=")[1]?.split(".")[0], e.cookie.split("=")[1]?.split(".")[0]],
      "a reset token": [token],
      "a book title": ["A Secret Title"],
    };
    for (const [what, values] of Object.entries(secrets)) {
      for (const v of values) {
        if (v) expect(all.includes(v), `the logs contain ${what}`).toBe(false);
      }
    }
  });
});
