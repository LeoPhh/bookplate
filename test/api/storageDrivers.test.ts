import { spawn } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Storage } from "@/lib/storage";
import { LocalStorage } from "@/lib/storage/local";
import { S3Storage } from "@/lib/storage/s3";
import { createDatabase, dropDatabase } from "./db";
import { createBucket, objectKeys, removeBucket, S3_TEST } from "./s3";

// The same behaviours, checked against both storage drivers: whatever the
// app does with images must work identically on disk and in a bucket.

const BUCKET = `bookplate-drivers-${process.pid}`;
const root = mkdtempSync(path.join(tmpdir(), "bookplate-drivers-"));
const bytes = (...b: number[]) => new Uint8Array(b);

const s3 = (over: Partial<ConstructorParameters<typeof S3Storage>[0]> = {}) =>
  new S3Storage({ ...S3_TEST, bucket: BUCKET, prefix: "", ...over });

beforeAll(() => createBucket(BUCKET));
afterAll(async () => {
  await removeBucket(BUCKET);
  rmSync(root, { recursive: true, force: true });
});

const drivers: [string, () => Storage][] = [
  ["local disk", () => new LocalStorage(path.join(root, String(Math.random())))],
  // Tiny listing pages, so paging through results is exercised too.
  ["S3", () => s3({ prefix: `run-${Math.random().toString(36).slice(2)}/`, pageSize: 2 })],
];

describe.each(drivers)("%s storage", (_name, make) => {
  it("stores, replaces and reads files", async () => {
    const st = make();
    await st.put("u1/covers/b1.jpg", bytes(1, 2, 3));
    expect(await st.get("u1/covers/b1.jpg")).toEqual(bytes(1, 2, 3));
    await st.put("u1/covers/b1.jpg", bytes(9));
    expect(await st.get("u1/covers/b1.jpg")).toEqual(bytes(9));
    expect(await st.get("u1/covers/missing.jpg")).toBeNull();
  });

  it("lists only the files directly under a folder, across several pages", async () => {
    const st = make();
    for (const n of ["a", "b", "c", "d", "e"]) await st.put(`u1/notes/b1/${n}.png`, bytes(1));
    await st.put("u1/notes/b1/deeper/x.png", bytes(1));
    await st.put("u1/notes/b10/other.png", bytes(1)); // a sibling folder sharing the name's start
    expect((await st.list("u1/notes/b1/")).sort()).toEqual(
      ["a", "b", "c", "d", "e"].map((n) => `u1/notes/b1/${n}.png`)
    );
    expect(await st.list("u1/notes/nothing-here/")).toEqual([]);
  });

  it("deletes single files and whole folders, leaving neighbours alone", async () => {
    const st = make();
    for (const n of ["a", "b", "c"]) await st.put(`u1/notes/b1/${n}.jpg`, bytes(1));
    await st.put("u1/notes/b1/deeper/x.jpg", bytes(1));
    await st.put("u1/notes/b2/keep.jpg", bytes(1));
    await st.put("u2/notes/b1/keep.jpg", bytes(1));

    await st.delete("u1/notes/b1/a.jpg");
    await st.delete("u1/notes/b1/never-existed.jpg"); // not an error
    expect(await st.get("u1/notes/b1/a.jpg")).toBeNull();

    await st.deletePrefix("u1/notes/b1/");
    expect(await st.list("u1/notes/b1/")).toEqual([]);
    expect(await st.get("u1/notes/b1/deeper/x.jpg")).toBeNull();
    expect(await st.get("u1/notes/b2/keep.jpg")).toEqual(bytes(1));
    expect(await st.get("u2/notes/b1/keep.jpg")).toEqual(bytes(1));
  });

  it("adds up the space used under a folder", async () => {
    const st = make();
    await st.put("u1/covers/b1.jpg", new Uint8Array(100));
    await st.put("u1/notes/b1/a.png", new Uint8Array(250));
    await st.put("u1/notes/b2/deeper/b.png", new Uint8Array(50));
    await st.put("u2/covers/b1.jpg", new Uint8Array(999));
    expect(await st.usage("u1/")).toBe(400);
    expect(await st.usage("u1/notes/")).toBe(300);
    expect(await st.usage("nobody/")).toBe(0);
  });

  it("refuses keys that try to escape their folder", async () => {
    const st = make();
    await expect(st.put("../escape.jpg", bytes(1))).rejects.toThrow();
    await expect(st.put("u1/../../escape.jpg", bytes(1))).rejects.toThrow();
  });
});

describe("S3 specifics", () => {
  it("keeps everything inside S3_PREFIX when one is set", async () => {
    const st = s3({ prefix: "shared-bucket/bookplate/" });
    await st.put("u9/covers/b1.jpg", bytes(1));
    expect(await objectKeys(BUCKET)).toContain("shared-bucket/bookplate/u9/covers/b1.jpg");
    expect(await st.list("u9/covers/")).toEqual(["u9/covers/b1.jpg"]); // keys come back without it
    await st.deletePrefix("u9/");
    expect((await objectKeys(BUCKET)).filter((k) => k.startsWith("shared-bucket/"))).toEqual([]);
  });

  it("deletes more than one request's worth of files", async () => {
    const st = s3({ prefix: "bulk/", pageSize: 1000 });
    await Promise.all(Array.from({ length: 1205 }, (_, i) => st.put(`u1/notes/b1/${i}.jpg`, bytes(1))));
    await st.deletePrefix("u1/");
    expect((await objectKeys(BUCKET)).filter((k) => k.startsWith("bulk/"))).toEqual([]);
  }, 60_000);

  it("explains wrong settings at startup", async () => {
    await expect(s3().check()).resolves.toBeUndefined();
    await expect(s3({ secretAccessKey: "wrong" }).check()).rejects.toThrow(/refused/);
    await expect(s3({ bucket: "no-such-bucket-here" }).check()).rejects.toThrow(/doesn't exist/);
    await expect(s3({ endpoint: "http://127.0.0.1:9" }).check()).rejects.toThrow(/couldn't reach/);
  });
});

describe("startup with wrong S3 settings", () => {
  it("exits with the reason instead of running without serving", async () => {
    const db = `bookplate_test_badstorage_${process.pid}`;
    const dbUrl = await createDatabase(db);
    try {
      const child = spawn(process.execPath, [path.resolve(__dirname, "../../.next/standalone/server.js")], {
        env: {
          PATH: process.env.PATH,
          NODE_ENV: "production",
          PORT: "0",
          HOSTNAME: "127.0.0.1",
          DATABASE_URL: dbUrl,
          AUTH_SECRET: "test-secret-that-is-long-enough-for-better-auth",
          PUBLIC_URL: "http://127.0.0.1",
          STORAGE: "s3",
          S3_ENDPOINT: S3_TEST.endpoint,
          S3_BUCKET: "no-such-bucket-here",
          S3_ACCESS_KEY_ID: S3_TEST.accessKeyId,
          S3_SECRET_ACCESS_KEY: S3_TEST.secretAccessKey,
          S3_FORCE_PATH_STYLE: "true",
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let log = "";
      child.stdout.on("data", (d) => (log += d));
      child.stderr.on("data", (d) => (log += d));
      const code = await new Promise((r) => child.once("exit", r));
      expect(code).toBe(1);
      expect(log).toMatch(/couldn't start: .*bucket "no-such-bucket-here" doesn't exist/);
    } finally {
      await dropDatabase(db);
    }
  }, 30_000);
});
