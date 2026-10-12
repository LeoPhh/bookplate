import { describe, expect, it } from "vitest";
import { wiktionaryUrl } from "@/components/VocabCard";

describe("wiktionaryUrl", () => {
  it("opens the word's English entry, as Wiktionary names its pages", () => {
    expect(wiktionaryUrl("blight")).toBe("https://en.wiktionary.org/wiki/blight#English");
    expect(wiktionaryUrl(" raison d'être ")).toBe("https://en.wiktionary.org/wiki/raison_d'%C3%AAtre#English");
  });
});
