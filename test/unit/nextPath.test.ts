import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/nextPath";

describe("safeNext", () => {
  it("allows plain paths on this server", () => {
    expect(safeNext("/f/AbCdEfGhIjKlMnOp")).toBe("/f/AbCdEfGhIjKlMnOp");
    expect(safeNext("/friends")).toBe("/friends");
  });

  it("refuses other sites and anything odd", () => {
    for (const bad of ["//evil.example", "/\\evil.example", "https://evil.example", "evil", "/a?b=c", "/a#b", "/a b", "", undefined, null]) {
      expect(safeNext(bad)).toBeNull();
    }
    expect(safeNext(`/${"a".repeat(300)}`)).toBeNull();
  });
});
