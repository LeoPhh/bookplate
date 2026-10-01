import { afterEach, describe, expect, it, vi } from "vitest";
import { newId } from "@/lib/id";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("newId", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses crypto.randomUUID when the browser has it", () => {
    expect(newId()).toMatch(UUID_V4);
  });

  // Plain-http pages (http://192.168.x.x) have no randomUUID — issue from 0.2.0.
  it("falls back to getRandomValues on insecure pages", () => {
    const real = globalThis.crypto;
    vi.stubGlobal("crypto", { getRandomValues: (a: Uint8Array) => real.getRandomValues(a) });
    const ids = new Set(Array.from({ length: 200 }, () => newId()));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(UUID_V4);
  });
});
