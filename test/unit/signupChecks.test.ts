import { describe, expect, it } from "vitest";
import { isPlausibleEmail, meetsPasswordRules } from "@/lib/signupChecks";

describe("isPlausibleEmail", () => {
  it("accepts ordinary addresses and catches common typos", () => {
    expect(isPlausibleEmail("reader@example.com")).toBe(true);
    expect(isPlausibleEmail(" reader@example.co.uk ")).toBe(true);
    expect(isPlausibleEmail("reader.example.com")).toBe(false);
    expect(isPlausibleEmail("reader@example")).toBe(false);
    expect(isPlausibleEmail("read er@example.com")).toBe(false);
    expect(isPlausibleEmail("")).toBe(false);
  });
});

describe("meetsPasswordRules", () => {
  it("needs six characters with lowercase and uppercase letters", () => {
    expect(meetsPasswordRules("Shelfs")).toBe(true);
    expect(meetsPasswordRules("Écrire1")).toBe(true);
    expect(meetsPasswordRules("Shelf")).toBe(false);
    expect(meetsPasswordRules("bookplate")).toBe(false);
    expect(meetsPasswordRules("BOOKPLATE")).toBe(false);
    expect(meetsPasswordRules("123456")).toBe(false);
  });
});
