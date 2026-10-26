import { randomUUID } from "crypto";
import { Client } from "pg";
import { expect, inject } from "vitest";
import { reader, socialBaseUrl, Visitor, type Reader } from "./client";

// Shared by the social tests: readers and visitors on the social test server
// (SOCIAL=true), and a way into its database for what has no API.

export interface Profile {
  handle: string;
  bio: string | null;
  visibility: "private" | "friends" | "public";
  shareReading: boolean;
  shareRatings: boolean;
}

// Unique across test files and runs (each file has its own copy of this module).
export const uniqueHandle = (base: string) => `${base.slice(0, 12)}_${randomUUID().slice(0, 8)}`;

export const socialReader = (name = "Reader") => reader(name, socialBaseUrl());
export const visitor = () => new Visitor(undefined, socialBaseUrl());

export async function withDb<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({ connectionString: inject("socialDbUrl") });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

export const userId = (r: Reader) =>
  withDb(async (c) => (await c.query('SELECT id FROM "user" WHERE email = $1', [r.email])).rows[0].id as string);

export async function makeProfile(r: Reader, body: Partial<Profile>): Promise<Profile> {
  const res = await r.json("/api/profile", "PATCH", body);
  expect(res.status).toBe(200);
  return ((await res.json()) as { profile: Profile }).profile;
}

// A reader with a profile, and their account id.
export async function withProfile(name = "Reader", over: Partial<Profile> = {}): Promise<{ r: Reader; p: Profile; id: string }> {
  const r = await socialReader(name);
  const p = await makeProfile(r, { handle: uniqueHandle(name.split(" ")[0].toLowerCase()), ...over });
  return { r, p, id: await userId(r) };
}
