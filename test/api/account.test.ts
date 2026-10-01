import { describe, expect, it } from "vitest";
import { book, jpeg, reader, Visitor } from "./client";

describe("changing the password", () => {
  it("needs the current one and signs other devices out", async () => {
    const r = await reader();
    const other = new Visitor();
    await other.json("/api/auth/sign-in/email", "POST", { email: r.email, password: r.password });

    expect((await r.json("/api/auth/change-password", "POST", { currentPassword: "nope-nope-nope", newPassword: "another-password" })).status).toBe(400);
    const ok = await r.json("/api/auth/change-password", "POST", {
      currentPassword: r.password,
      newPassword: "another-password",
      revokeOtherSessions: true,
    });
    expect(ok.status).toBe(200);
    expect((await r.fetch("/api/books")).status).toBe(200);
    expect((await other.fetch("/api/books")).status).toBe(401);
  });
});

describe("deleting an account", () => {
  it("needs the password, removes everything, and leaves others alone", async () => {
    const a = await reader("A");
    const b = await reader("B");
    for (const r of [a, b]) {
      await r.json("/api/books/b1", "PUT", book("b1", { coverImage: "/api/covers/b1.jpg" }));
      await r.upload("/api/covers", { file: jpeg(), id: "b1" });
    }

    expect((await a.json("/api/account", "DELETE", {})).status).toBe(400);
    expect((await a.json("/api/account", "DELETE", { password: "wrong-guess" })).status).toBe(403);
    expect((await a.json("/api/account", "DELETE", { password: a.password })).status).toBe(200);

    expect((await a.fetch("/api/books")).status).toBe(401);
    const signIn = await new Visitor().json("/api/auth/sign-in/email", "POST", { email: a.email, password: a.password });
    expect(signIn.status).toBe(401);
    expect((await b.get<{ books: unknown[] }>("/api/books")).books).toHaveLength(1);
    expect((await b.fetch("/api/covers/b1.jpg")).status).toBe(200);
  });

  it("stops guessing the password after 5 wrong tries", async () => {
    const r = await reader();
    for (let i = 0; i < 5; i++) expect((await r.json("/api/account", "DELETE", { password: "wrong-guess" })).status).toBe(403);
    expect((await r.json("/api/account", "DELETE", { password: r.password })).status).toBe(429);
    expect((await r.fetch("/api/books")).status).toBe(200); // still there
  });

  it("is not possible through Better Auth's own endpoint", async () => {
    const r = await reader();
    expect((await r.json("/api/auth/delete-user", "POST", {})).status).toBe(404);
  });
});
