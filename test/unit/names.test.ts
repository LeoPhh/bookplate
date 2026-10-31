import { describe, expect, it } from "vitest";
import { suggestName } from "@/lib/names";

describe("suggestName", () => {
  it("reads a first and last name out of an address", () => {
    expect(suggestName("jane.smith@example.com")).toBe("Jane Smith");
    expect(suggestName("jane_smith92@example.com")).toBe("Jane Smith");
    expect(suggestName("Jane-Smith+books@example.com")).toBe("Jane Smith");
    expect(suggestName("mary.ann.evans@example.com")).toBe("Mary Ann Evans");
    expect(suggestName("élodie.durand@example.com")).toBe("Élodie Durand");
  });

  it("suggests nothing when the address doesn't clearly hold one", () => {
    for (const email of [
      "jsmith93@example.com",
      "coolcat@example.com",
      "info@example.com",
      "info.team@example.com",
      "no-reply@example.com",
      "j.smith@example.com",
      "a.b.c.d@example.com",
      "12345@example.com",
      "bartholomew.featherstonehaugh@example.com",
    ]) {
      expect(suggestName(email), email).toBe("");
    }
  });
});
