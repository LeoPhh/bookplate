import { afterEach, describe, expect, it } from "vitest";
import { legalElsewhere, legalLinks } from "@/lib/legal";

const saved = { privacy: process.env.PRIVACY_URL, terms: process.env.TERMS_URL };

afterEach(() => {
  for (const [key, value] of [
    ["PRIVACY_URL", saved.privacy],
    ["TERMS_URL", saved.terms],
  ] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("legal documents published elsewhere", () => {
  it("lead to that address when PRIVACY_URL and TERMS_URL are set", () => {
    process.env.PRIVACY_URL = "https://example.com/privacy";
    process.env.TERMS_URL = "https://example.com/terms";
    expect(legalElsewhere("privacy")).toBe("https://example.com/privacy");
    expect(legalElsewhere("terms")).toBe("https://example.com/terms");
    expect(legalLinks()).toEqual({ privacy: "https://example.com/privacy", terms: "https://example.com/terms" });
  });

  it("are not a thing when the addresses are unset", () => {
    delete process.env.PRIVACY_URL;
    delete process.env.TERMS_URL;
    expect(legalElsewhere("privacy")).toBeNull();
    expect(legalElsewhere("terms")).toBeNull();
  });

  it("refuse an address that isn't a web address", () => {
    process.env.PRIVACY_URL = "example.com/privacy";
    expect(() => legalElsewhere("privacy")).toThrow(/PRIVACY_URL/);
    process.env.PRIVACY_URL = "javascript:alert(1)";
    expect(() => legalElsewhere("privacy")).toThrow(/PRIVACY_URL/);
  });
});
