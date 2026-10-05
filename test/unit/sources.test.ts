import { describe, expect, it } from "vitest";
import { isCustomSource, normaliseSource, sourceLabel } from "@/lib/types";

describe("sources", () => {
  it("labels built-in sources and passes the reader's own through", () => {
    expect(sourceLabel("kindle")).toBe("Kindle");
    expect(sourceLabel("secondhand")).toBe("Second hand");
    expect(sourceLabel("Flea market")).toBe("Flea market");
    expect(sourceLabel(undefined)).toBeUndefined();
    expect(sourceLabel("")).toBeUndefined();
  });

  it("tells the reader's own sources from the built-in ones", () => {
    expect(isCustomSource("Flea market")).toBe(true);
    expect(isCustomSource("kindle")).toBe(false);
    expect(isCustomSource("")).toBe(false);
    expect(isCustomSource(undefined)).toBe(false);
  });

  it("turns a typed source that matches a built-in into that built-in", () => {
    expect(normaliseSource("  Kindle ")).toBe("kindle");
    expect(normaliseSource("book store")).toBe("bookstore");
    expect(normaliseSource("Second Hand")).toBe("secondhand");
    expect(normaliseSource(" Flea market ")).toBe("Flea market");
    expect(normaliseSource("   ")).toBe("");
  });
});
