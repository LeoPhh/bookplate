import { randomInt, randomUUID } from "crypto";
import { inject } from "vitest";

// A tiny browser stand-in for the API tests: keeps the session cookie and
// sends the headers the app expects (Origin for sign-in, and an
// X-Forwarded-For address of its own, as a reverse proxy would add — so the
// per-IP sign-up limit treats each test visitor separately).

export const baseUrl = () => inject("baseUrl");
export const emailBaseUrl = () => inject("emailBaseUrl");

export class Visitor {
  cookie = "";
  readonly ip: string;
  readonly base: string;

  // A random private address per visitor, unique across test files. `base`
  // picks the test server (the plain one unless given).
  constructor(ip?: string, base?: string) {
    this.ip = ip ?? `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;
    this.base = base ?? baseUrl();
  }

  async fetch(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("Origin", this.base);
    headers.set("X-Forwarded-For", this.ip);
    if (this.cookie) headers.set("Cookie", this.cookie);
    const res = await fetch(path.startsWith("http") ? path : this.base + path, { ...init, headers, redirect: "manual" });
    const set = res.headers.getSetCookie();
    if (set.length) this.cookie = set.map((c) => c.split(";")[0]).join("; ");
    return res;
  }

  json(path: string, method: string, body?: unknown): Promise<Response> {
    return this.fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  upload(path: string, fields: Record<string, string | Blob>): Promise<Response> {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    return this.fetch(path, { method: "POST", body: fd });
  }

  async get<T = unknown>(path: string): Promise<T> {
    const res = await this.fetch(path);
    if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
    return res.json() as Promise<T>;
  }
}

export interface Reader extends Visitor {
  email: string;
  password: string;
}

// A new account. On the plain server it's signed in straight away; on the
// email server it still has to confirm its address (see confirmedReader).
export async function reader(name = "Reader", base?: string): Promise<Reader> {
  const v = new Visitor(undefined, base) as Reader;
  v.email = `${randomUUID()}@example.com`;
  v.password = `pw-${randomUUID()}`;
  const res = await v.json("/api/auth/sign-up/email", "POST", { name, email: v.email, password: v.password, callbackURL: "/login" });
  if (!res.ok) throw new Error(`sign-up failed: ${res.status} ${await res.text()}`);
  return v;
}

// Bytes that pass for each image type (the server checks the first bytes).
export const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(2000).fill(7)])], { type: "image/jpeg" });
export const png = () =>
  new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(64).fill(1)])], { type: "image/png" });
export const html = (type = "image/jpeg") => new Blob(["<html><script>alert(1)</script></html>"], { type });

export const book = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  title: `Book ${id}`,
  author: "Author",
  status: "read",
  rating: 4,
  colorIndex: 1,
  addedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

// A new account on the email server that has confirmed its address by
// following the link in its welcome email — and is signed in as a result.
export async function confirmedReader(name = "Reader"): Promise<Reader> {
  const { waitForMail, linkIn } = await import("./mailpit");
  const r = await reader(name, emailBaseUrl());
  const mail = await waitForMail(r.email, "Confirm your email");
  const res = await r.fetch(linkIn(mail, `${emailBaseUrl()}/api/auth/verify-email`));
  if (res.status !== 302 && res.status !== 307) throw new Error(`confirming failed: ${res.status}`);
  return r;
}
