"use client";

import { useEffect, useMemo, useState } from "react";
import { Book } from "@/lib/types";
import { paletteFor } from "@/lib/palette";

interface Props {
  books: Book[];
  selectedId: string;
  onSelect: (id: string) => void; // "" for no book
  onClose: () => void;
}

// Picks the book a word came from: a searchable list of the library, with
// the books being read right now at the top, since that's where most new
// words turn up.
export default function BookPicker({ books, selectedId, onSelect, onClose }: Props) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    // Capture phase + stopPropagation so Escape closes only the picker, not
    // the lookup results underneath.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return books
      .filter((b) => !q || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q))
      .sort((a, b) => Number(b.status === "reading") - Number(a.status === "reading") || a.title.localeCompare(b.title));
  }, [books, query]);

  const pick = (id: string) => {
    onSelect(id);
    onClose();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="dialog dialog--picker"
        role="dialog"
        aria-modal="true"
        aria-label="Which book is it from?"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="dialog-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <h2 className="confirm-title">Which book is it from?</h2>
        <input
          type="search"
          className="search picker-search"
          placeholder="Search your library…"
          aria-label="Search your library"
          value={query}
          autoFocus
          onChange={(e) => setQuery(e.target.value)}
          // Enter takes the first match, so a title can be typed and picked.
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (matches.length > 0) pick(matches[0].id);
          }}
        />
        <ul className="search-results picker-results">
          {!query.trim() && (
            <li>
              <button
                type="button"
                className={selectedId ? "search-result" : "search-result search-result--chosen"}
                aria-pressed={!selectedId}
                onClick={() => pick("")}
              >
                <span className="search-thumb">
                  <span className="search-thumb-blank">—</span>
                </span>
                <span className="search-result-text">
                  <span className="search-result-title">No book</span>
                  <span className="search-result-meta">Keep the word on its own</span>
                </span>
              </button>
            </li>
          )}
          {matches.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                className={b.id === selectedId ? "search-result search-result--chosen" : "search-result"}
                aria-pressed={b.id === selectedId}
                onClick={() => pick(b.id)}
              >
                <span className="search-thumb" style={{ background: paletteFor(b.colorIndex).bg }}>
                  {b.coverImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.coverImage} alt="" loading="lazy" />
                  )}
                </span>
                <span className="search-result-text">
                  <span className="search-result-title">{b.title}</span>
                  <span className="search-result-meta">
                    {b.author}
                    {b.status === "reading" && " · Reading"}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {matches.length === 0 && (
          <p className="search-note">
            {books.length === 0 ? "Your library is empty. Add a book first." : "No book in your library matches."}
          </p>
        )}
      </div>
    </div>
  );
}
