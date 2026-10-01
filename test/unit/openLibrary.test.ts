import { describe, expect, it } from "vitest";
import { isWorkId, toSearchResults, workIdFromKey } from "@/lib/openLibrary";

describe("Open Library work ids", () => {
  it("are read from a search result's key", () => {
    expect(workIdFromKey("/works/OL893414W")).toBe("OL893414W");
    expect(workIdFromKey("/books/OL7353617M")).toBeNull(); // an edition, not a work
    expect(workIdFromKey("OL893414W")).toBeNull();
    expect(workIdFromKey(undefined)).toBeNull();
  });

  it("are validated strictly", () => {
    expect(isWorkId("OL893414W")).toBe(true);
    expect(isWorkId("OL893414M")).toBe(false);
    expect(isWorkId("ol893414w")).toBe(false);
    expect(isWorkId("OL893414W; drop table")).toBe(false);
    expect(isWorkId(893414)).toBe(false);
  });
});

describe("toSearchResults", () => {
  // Shaped like a real response for "dune frank herbert".
  const docs = [
    { key: "/works/OL893414W", title: "Dune", author_name: ["Frank Herbert"], number_of_pages_median: 658, cover_i: 11481354, first_publish_year: 1965 },
    { key: "/works/OL893461W", title: "Dune Messiah", author_name: ["Frank Herbert"] },
    { key: "/works/OL1W", author_name: ["No Title"] },
  ];

  it("keeps the work id with each result and drops untitled ones", () => {
    expect(toSearchResults(docs)).toEqual([
      { title: "Dune", author: "Frank Herbert", pages: 658, coverId: 11481354, year: 1965, workId: "OL893414W" },
      { title: "Dune Messiah", author: "Frank Herbert", pages: null, coverId: null, year: null, workId: "OL893461W" },
    ]);
  });

  it("copes with a missing key or an empty response", () => {
    expect(toSearchResults([{ title: "Loose" }])[0].workId).toBeNull();
    expect(toSearchResults(undefined)).toEqual([]);
  });
});
