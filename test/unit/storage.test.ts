import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { afterAll, describe, expect, it } from "vitest";
import { contentTypeOf, detectImageType, isSafeFileName, isSafeId } from "@/lib/storage";
import { LocalStorage } from "@/lib/storage/local";

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);

describe("detectImageType", () => {
  it("identifies images by their first bytes", () => {
    expect(detectImageType(bytes(0xff, 0xd8, 0xff))).toBe("image/jpeg");
    expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(detectImageType(bytes(0x47, 0x49, 0x46, 0x38))).toBe("image/gif");
    const webp = bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50);
    expect(detectImageType(webp)).toBe("image/webp");
  });

  it("rejects anything else, whatever it is called", () => {
    expect(detectImageType(new TextEncoder().encode("<html><script>alert(1)</script>"))).toBeNull();
    expect(detectImageType(new Uint8Array())).toBeNull();
  });
});

describe("names", () => {
  it("allows only plain ids and image file names", () => {
    expect(isSafeId("gr-234225")).toBe(true);
    expect(isSafeId("../x")).toBe(false);
    expect(isSafeFileName("b1.jpg")).toBe(true);
    expect(isSafeFileName("b1.svg")).toBe(false);
    expect(isSafeFileName("../b1.jpg")).toBe(false);
    expect(contentTypeOf("a.webp")).toBe("image/webp");
  });
});

describe("LocalStorage", () => {
  const root = mkdtempSync(path.join(tmpdir(), "bookplate-storage-"));
  const storage = new LocalStorage(root);
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it("stores, lists and deletes files under a prefix", async () => {
    await storage.put("u1/notes/b1/a.jpg", new Uint8Array([1, 2, 3]));
    await storage.put("u1/notes/b1/b.png", new Uint8Array([4]));
    expect(await storage.get("u1/notes/b1/a.jpg")).toEqual(new Uint8Array([1, 2, 3]));
    expect((await storage.list("u1/notes/b1/")).sort()).toEqual(["u1/notes/b1/a.jpg", "u1/notes/b1/b.png"]);
    await storage.deletePrefix("u1/notes/b1/");
    expect(await storage.list("u1/notes/b1/")).toEqual([]);
    expect(await storage.get("u1/missing.jpg")).toBeNull();
  });

  it("refuses keys that escape its folder", async () => {
    await expect(storage.put("../escape.jpg", new Uint8Array([1]))).rejects.toThrow();
    await expect(storage.get("../../etc/passwd")).resolves.toBeNull();
  });
});
