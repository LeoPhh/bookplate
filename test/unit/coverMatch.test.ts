import { describe, expect, it } from "vitest";
import { sameBook } from "@/lib/coverLookup";

// The iTunes fallback always returns *something*; only real matches count.
describe("sameBook", () => {
  it("accepts the same title and author, ignoring subtitles and edition blurbs", () => {
    expect(sameBook({ trackName: "Piranesi", artistName: "Susanna Clarke" }, "Piranesi", "Susanna Clarke")).toBe(true);
    expect(
      sameBook({ trackName: "The Hobbit", artistName: "J. R. R. Tolkien" }, "The Hobbit, or There and Back Again", "J.R.R. Tolkien")
    ).toBe(true);
    expect(
      sameBook({ trackName: "Klara and the Sun: A GMA Book Club Pick", artistName: "Kazuo Ishiguro" }, "Klara and the Sun", "Kazuo Ishiguro")
    ).toBe(true);
  });

  it("rejects a different book (the real result iTunes gave for a made-up title)", () => {
    expect(
      sameBook(
        { trackName: "Edit, Self-publish; Sell your book with Six Top Online Publishers", artistName: "Book Nanny" },
        "A Book With No ISBN",
        "Some Author"
      )
    ).toBe(false);
  });

  it("rejects the right title by the wrong author", () => {
    expect(sameBook({ trackName: "Dune", artistName: "Someone Else" }, "Dune", "Frank Herbert")).toBe(false);
  });
});
