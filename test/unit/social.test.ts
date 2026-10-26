import { describe, expect, it } from "vitest";
import { canSee, pairOf, type Audience } from "@/lib/social/access";
import { checkHandle, parseProfile, ProfileError, type Profile } from "@/lib/social/profile";
import { buildProfileStats } from "@/lib/social/profileStats";
import { personBook, profileAvatar, profileCover, SHOWN_FIELDS, visibleBooks } from "@/lib/social/projection";
import { workKey } from "@/lib/social/workKey";
import type { Book } from "@/lib/types";

// The pure parts of the social features (lib/social/).

const book = (id: string, over: Partial<Book> = {}): Book => ({
  id,
  title: `Book ${id}`,
  author: "Author",
  status: "read",
  rating: 0,
  colorIndex: 0,
  addedAt: "2025-01-01T00:00:00.000Z",
  ...over,
});

const profile = (over: Partial<Profile> = {}): Profile => ({
  handle: "ada",
  bio: null,
  visibility: "friends",
  shareReading: true,
  shareRatings: true,
  ...over,
});

describe("handles", () => {
  it("are lower case letters, digits and underscores, however they're typed", () => {
    expect(checkHandle("  @Ada_L ")).toBe("ada_l");
    for (const bad of ["ab", "a".repeat(25), "ada lovelace", "ada-l", "ådä", ""]) {
      expect(() => checkHandle(bad)).toThrow(ProfileError);
    }
  });

  it("can't pass for the service speaking", () => {
    for (const taken of ["admin", "Support", "bookplate", "bookplate_team", "settings"]) {
      expect(() => checkHandle(taken)).toThrow("That handle is taken.");
    }
  });
});

describe("parseProfile", () => {
  it("keeps only the fields sent, tidied", () => {
    expect(parseProfile({ bio: "  Mostly\nnovels  ‮" })).toEqual({ bio: "Mostly novels" });
    expect(parseProfile({ bio: "" })).toEqual({ bio: null });
    expect(parseProfile({ visibility: "public", shareRatings: false })).toEqual({ visibility: "public", shareRatings: false });
  });

  it("refuses anything else", () => {
    expect(() => parseProfile({ visibility: "everyone" })).toThrow(ProfileError);
    expect(() => parseProfile({ shareReading: "yes" })).toThrow(ProfileError);
    expect(() => parseProfile({ bio: "x".repeat(161) })).toThrow(ProfileError);
    expect(() => parseProfile({ handle: 42 })).toThrow(ProfileError);
  });
});

describe("who sees a profile", () => {
  it("follows its visibility, and never a blocked reader", () => {
    const table: Record<Audience, [boolean, boolean, boolean]> = {
      // private, friends, public
      self: [true, true, true],
      friend: [false, true, true],
      stranger: [false, false, true],
      blocked: [false, false, false],
    };
    for (const [audience, expected] of Object.entries(table)) {
      expect((["private", "friends", "public"] as const).map((v) => canSee(audience as Audience, v))).toEqual(expected);
    }
  });

  it("stores each pair of friends one way round", () => {
    expect(pairOf("b", "a")).toEqual(["a", "b"]);
    expect(pairOf("a", "b")).toEqual(["a", "b"]);
  });
});

describe("what others see of a library", () => {
  const library = [
    book("read", { status: "read", dateRead: "2025-03-01" }),
    book("again", { status: "reading", pastReads: [{ date: "2024-01-01" }] }),
    book("now", { status: "reading" }),
    book("tbr", { status: "to-read" }),
    book("dnf", { status: "dnf" }),
  ];
  const ids = (books: Book[]) => books.map((b) => b.id);

  it("shows strangers what was read, and friends the to-read shelf and what's being read", () => {
    expect(ids(visibleBooks(library, "stranger", profile()))).toEqual(["read", "again"]);
    expect(ids(visibleBooks(library, "friend", profile()))).toEqual(["read", "again", "now", "tbr"]);
    expect(ids(visibleBooks(library, "friend", profile({ shareReading: false })))).toEqual(["read", "again", "tbr"]);
    expect(ids(visibleBooks(library, "self", profile()))).toEqual(ids(library));
  });

  it("never shows notes, sources, copies or when a book was added", () => {
    const full = book("x", {
      isbn: "9780141439518",
      olWorkId: "OL1W",
      genre: "Novel",
      pages: 800,
      format: "kindle",
      copy: true,
      rating: 4,
      dateRead: "2025-01-01",
      pastReads: [{ date: "2020-01-01" }],
      notes: "a private thought",
      coverImage: "/api/covers/x.jpg?v=2",
    });
    const shown = personBook(full, profile(), "ada");
    for (const k of ["format", "copy", "notes", "addedAt"]) expect(shown).not.toHaveProperty(k);
    expect(Object.keys(shown).sort()).toEqual([...SHOWN_FIELDS].sort());
    expect(shown.coverImage).toBe("/u/ada/covers/x.jpg?v=2");
    expect(personBook(full, profile({ shareRatings: false }), "ada").rating).toBe(0);
    // The owner's own view keeps their own cover address.
    expect(personBook(full, profile(), null).coverImage).toBe("/api/covers/x.jpg?v=2");
  });

  it("moves images to the profile's own addresses, and nothing else", () => {
    expect(profileCover("ada", "/api/covers/a.jpg")).toBe("/u/ada/covers/a.jpg");
    expect(profileCover("ada", "https://elsewhere/a.jpg")).toBeUndefined();
    expect(profileAvatar("ada", "/api/avatar/p.jpg")).toBe("/u/ada/avatar/p.jpg");
    expect(profileAvatar("ada", null)).toBeNull();
  });
});

describe("workKey", () => {
  it("prefers the Open Library work, then the ISBN, then the title and author", () => {
    expect(workKey({ olWorkId: "ol893415w", isbn: "9780141439518", title: "Middlemarch", author: "George Eliot" })).toBe("ol:OL893415W");
    expect(workKey({ isbn: "978-0-14-143951-8", title: "Middlemarch", author: "George Eliot" })).toBe("isbn:9780141439518");
    expect(workKey({ title: "Middlemarch", author: "George Eliot" })).toBe("t:middlemarch|george eliot");
  });

  it("matches the ISBN-10 and ISBN-13 of one edition", () => {
    expect(workKey({ isbn: "0141439513", title: "", author: "" })).toBe("isbn:9780141439518");
  });

  it("matches typed-in titles despite case, accents, articles and subtitles", () => {
    const a = workKey({ title: "The Name of the Rose: A Novel", author: "Umberto Eco" });
    expect(workKey({ title: "name of the rose", author: "umberto  eco" })).toBe(a);
    expect(workKey({ title: "Les Misérables", author: "Victor Hugo" })).toBe(workKey({ title: "les miserables", author: "Victor Hugo" }));
  });
});

describe("buildProfileStats", () => {
  const library = [
    book("a", { dateRead: "2025-03-01", pages: 300, rating: 4, genre: "Novel", author: "Eliot" }),
    book("b", { dateRead: "2025-05-01", pages: 200, rating: 2, genre: "Novel", author: "Eliot", pastReads: [{ date: "2023-02-01" }] }),
    book("c", { dateRead: "2024-07-01", genre: "Poetry", author: "Keats" }),
    book("now", { status: "reading", pages: 400 }),
    book("tbr", { status: "to-read" }),
  ];

  it("counts every finish, rereads included, since the first", () => {
    const s = buildProfileStats(library, [], { year: 2025, today: "2025-06-01" });
    expect(s.totals).toEqual({ books: 4, pages: 700, rating: 3, since: 2023 });
    expect(s.genre).toEqual({ name: "Novel", books: 2 });
    expect(s.author).toEqual({ name: "Eliot", books: 2 });
    expect(s.toRead).toBe(1);
    expect(s.recent.map((b) => b.id)).toEqual(["b", "a", "c"]);
    expect(s.years).toEqual([
      { year: 2025, books: 2 },
      { year: 2024, books: 1 },
      { year: 2023, books: 1 },
    ]);
    expect(s.year.read.map((b) => b.id)).toEqual(["a", "b"]);
  });

  it("shows how far along a book being read is, from its progress", () => {
    const s = buildProfileStats(library, [{ bookId: "now", date: "2025-05-30", page: 100, percent: 25 }], {
      year: 2025,
      today: "2025-06-01",
    });
    expect(s.reading).toEqual([{ book: library[3], percent: 25 }]);
  });

  it("names a most-read author only with two books or more", () => {
    const s = buildProfileStats([book("x", { dateRead: "2025-01-01" })], [], { year: 2025, today: "2025-06-01" });
    expect(s.author).toBeUndefined();
    expect(s.totals.rating).toBeUndefined();
  });
});
