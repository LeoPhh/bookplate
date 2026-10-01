import { randomInt, randomUUID } from "crypto";
import { Client } from "pg";
import { describe, expect, inject, it } from "vitest";
import { reader, Visitor } from "./client";

const newEmail = () => `${randomUUID()}@example.com`;
const password = "a-long-password-1";

describe("sign-up bot check", () => {
  it("hands out puzzles to visitors who aren't signed in", async () => {
    const res = await new Visitor().fetch("/api/signup-challenge");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(await res.json()).toMatchObject({ parameters: { algorithm: "PBKDF2/SHA-256" }, signature: expect.any(String) });
  });

  it("refuses sign-ups without a solved puzzle", async () => {
    const v = new Visitor();
    expect((await v.signUp(newEmail(), password, "Bot", {})).status).toBe(403);
    expect((await v.signUp(newEmail(), password, "Bot", { "x-signup-challenge": "not-a-puzzle" })).status).toBe(403);
  });

  it("refuses a puzzle with a made-up answer", async () => {
    const v = new Visitor();
    const challenge = await (await v.fetch("/api/signup-challenge")).json();
    const forged = { challenge, solution: { counter: 1, derivedKey: "00".repeat(32) } };
    const res = await v.signUp(newEmail(), password, "Bot", {
      "x-signup-challenge": Buffer.from(JSON.stringify(forged)).toString("base64"),
    });
    expect(res.status).toBe(403);
  });

  it("accepts each solved puzzle only once", async () => {
    const v = new Visitor();
    const solved = await v.signupChallenge();
    expect((await v.signUp(newEmail(), password, "Reader", solved)).status).toBe(200);
    const again = await new Visitor().signUp(newEmail(), password, "Bot", solved);
    expect(again.status).toBe(403);
    expect(await again.text()).toContain("reload the page");
  });
});

describe("sign-ups per address", () => {
  it("allows five new accounts an hour from one address, whatever else the request claims", async () => {
    // A proxy appends the real address last; a script can only make up the
    // entries before it — which mustn't buy it more accounts.
    const real = `10.200.${randomInt(256)}.${randomInt(1, 255)}`;
    const spoofing = () => new Visitor(`198.51.100.${randomInt(1, 255)}, ${real}`);
    for (let i = 0; i < 3; i++) expect((await spoofing().signUp(newEmail(), password)).status).toBe(200);
    // Better Auth's own limit (3 sign-ups per 10 seconds, same address) would
    // answer next; wait it out, so the hourly limit is what's being tested.
    await new Promise((r) => setTimeout(r, 10_500));
    for (let i = 0; i < 2; i++) expect((await spoofing().signUp(newEmail(), password)).status).toBe(200);

    const blocked = await spoofing().signUp(newEmail(), password);
    expect(blocked.status).toBe(429);
    expect(await blocked.text()).toContain("Too many new accounts");

    // Someone else is unaffected.
    expect((await new Visitor().signUp(newEmail(), password)).status).toBe(200);
  }, 30_000);

  it("counts only sign-ups that created an account", async () => {
    const ip = `10.201.${randomInt(256)}.${randomInt(1, 255)}`;
    // Too short a password: refused, and not counted against the address.
    expect((await new Visitor(ip).signUp(newEmail(), "short")).status).toBe(400);
    expect((await new Visitor(ip).signUp(newEmail(), password)).status).toBe(200);
    const db = new Client({ connectionString: inject("dbUrl") });
    await db.connect();
    try {
      const { rows } = await db.query("SELECT failures FROM auth_throttle WHERE key = $1", [`sign-up:${ip}`]);
      expect(rows).toEqual([{ failures: 1 }]);
    } finally {
      await db.end();
    }
  });
});

describe("sign-in rate limits", () => {
  it("can't be used by someone faking addresses to lock others out", async () => {
    const victim = await reader();
    // Requests that all claim the same made-up address, from one real one…
    const attacker = `10.202.${randomInt(256)}.${randomInt(1, 255)}`;
    for (let i = 0; i < 5; i++) {
      await new Visitor(`203.0.113.66, ${attacker}`).json("/api/auth/sign-in/email", "POST", {
        email: newEmail(),
        password: "wrong-password",
      });
    }
    // …don't touch anyone at another real address, whatever they claim.
    const res = await new Visitor(`203.0.113.66, ${victim.ip}`).json("/api/auth/sign-in/email", "POST", {
      email: victim.email,
      password: victim.password,
    });
    expect(res.status).toBe(200);
  });
});
