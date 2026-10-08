import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { csvRecords } from "@/lib/csv";
import { cleanDate, cleanIsbn, cleanRating, cleanTitle, detectSource, statusFrom } from "@/lib/csvImport";

const fixture = (name: string) => readFileSync(path.join(__dirname, "../fixtures", name), "utf8");

describe("detectSource", () => {
  it("recognises the Goodreads and StoryGraph fixtures", () => {
    expect(detectSource(csvRecords(fixture("goodreads_library_export.csv")).headers)).toBe("goodreads");
    expect(detectSource(csvRecords(fixture("storygraph_export.csv")).headers)).toBe("storygraph");
  });

  it("rejects anything else", () => {
    expect(detectSource(["Name", "Email"])).toBeNull();
  });
});

describe("statusFrom", () => {
  it("reads both services' shelves", () => {
    expect(statusFrom("read")).toBe("read");
    expect(statusFrom("currently-reading")).toBe("reading");
    expect(statusFrom("to-read")).toBe("to-read");
    expect(statusFrom("did-not-finish")).toBe("dnf");
  });

  it("recognises the shelves Goodreads readers make for books they didn't finish", () => {
    for (const shelf of ["dnf", "DNF", "dnf-2024", "didnt-finish", "did-not-finish", "abandoned", "gave-up", "unfinished", "not-finished", "stopped-reading"]) {
      expect(statusFrom(shelf), shelf).toBe("dnf");
    }
  });

  it("puts any other custom shelf in TBR", () => {
    for (const shelf of ["favourites", "owned", "sci-fi", ""]) expect(statusFrom(shelf), shelf).toBe("to-read");
  });
});

describe("cleanIsbn", () => {
  it('unwraps Goodreads\' ="…" quoting', () => {
    expect(cleanIsbn('="9780441013593"')).toBe("9780441013593");
    expect(cleanIsbn('="0441013597"')).toBe("0441013597");
  });

  it("keeps a trailing X and rejects wrong lengths or blanks", () => {
    expect(cleanIsbn("080442957x")).toBe("080442957X");
    expect(cleanIsbn('=""')).toBeUndefined();
    expect(cleanIsbn("12345")).toBeUndefined();
  });
});

describe("cleanDate", () => {
  it("normalises slashes and pads", () => {
    expect(cleanDate("2023/1/5")).toBe("2023-01-05");
    expect(cleanDate("2024-03-14")).toBe("2024-03-14");
    expect(cleanDate("")).toBeUndefined();
    expect(cleanDate("March 2024")).toBeUndefined();
  });
});

describe("cleanRating", () => {
  it("rounds to half stars and treats 0 as unrated", () => {
    expect(cleanRating("5.0")).toBe(5);
    expect(cleanRating("4.25")).toBe(4.5);
    expect(cleanRating("4.75")).toBe(5);
    expect(cleanRating("0")).toBe(0);
    expect(cleanRating("")).toBe(0);
    expect(cleanRating("9")).toBe(5);
  });
});

describe("cleanTitle", () => {
  it("drops Goodreads' series suffix but keeps ordinary parentheses", () => {
    expect(cleanTitle("Dune (Dune, #1)")).toBe("Dune");
    expect(cleanTitle("The Final Empire (Mistborn #1)")).toBe("The Final Empire");
    expect(cleanTitle("The Hobbit, or There and Back Again")).toBe("The Hobbit, or There and Back Again");
    expect(cleanTitle("Notes (Revised Edition)")).toBe("Notes (Revised Edition)");
  });
});
