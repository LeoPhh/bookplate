import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import BookCover from "@/components/BookCover";
import type { Book } from "@/lib/types";

const book: Book = { id: "b1", title: "Dune", author: "Frank Herbert", status: "read", rating: 0, colorIndex: 0, addedAt: "2026-01-01T00:00:00Z" };

describe("BookCover", () => {
  it("loads cover photos lazily, so a big library doesn't request them all at once", () => {
    const html = renderToStaticMarkup(createElement(BookCover, { book: { ...book, coverImage: "/api/covers/b1.jpg?v=1" } }));
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('src="/api/covers/b1.jpg?v=1"');
  });
});
