import { describe, expect, it } from "vitest";
import { FriendError } from "@/lib/social/errors";
import { parseRecommendation } from "@/lib/social/recs";

describe("parseRecommendation", () => {
  it("keeps the book and a note, tidied to one line", () => {
    expect(
      parseRecommendation({ to: "u1", title: "  Middlemarch ", author: "George\nEliot", isbn: "978-0-14-143951-8", note: " You'll\nlove it " })
    ).toEqual({ to: "u1", title: "Middlemarch", author: "George Eliot", isbn: "9780141439518", olWorkId: undefined, note: "You'll love it" });
    expect(parseRecommendation({ to: "u1", title: "Dune", author: "", olWorkId: "OL893415W" })).toMatchObject({ olWorkId: "OL893415W", note: null });
  });

  it("refuses anything else", () => {
    for (const bad of [
      { title: "Dune", author: "Herbert" }, // to whom?
      { to: "u1", title: "  ", author: "Herbert" },
      { to: "u1", title: "Dune" },
      { to: "u1", title: "Dune", author: "Herbert", isbn: "nope" },
      { to: "u1", title: "Dune", author: "Herbert", olWorkId: "12345" },
      { to: "u1", title: "Dune", author: "Herbert", note: "x".repeat(281) },
      { to: "u1", title: "x".repeat(301), author: "Herbert" },
    ]) {
      expect(() => parseRecommendation(bad), JSON.stringify(bad).slice(0, 60)).toThrow(FriendError);
    }
  });
});
