"use client";

import { useEffect, useMemo, useState } from "react";
import { paletteFor } from "@/lib/palette";
import type { Book } from "@/lib/types";
import Spinner from "./Spinner";

// Recommending a book to a friend, from their profile: pick one from your
// library (or type a title and author in), add a note if you like, send.

const NOTE_MAX = 280;

export default function RecommendDialog({ to, name, onClose }: { to: string; name: string; onClose: () => void }) {
  const [books, setBooks] = useState<Book[] | null>(null);
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<Book | null>(null);
  const [typing, setTyping] = useState(false); // typing a book in rather than picking one
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    fetch("/api/books")
      .then((r) => (r.ok ? r.json() : { books: [] }))
      .then((d: { books: Book[] }) => setBooks(d.books))
      .catch(() => setBooks([]));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (books ?? [])
      .filter((b) => !q || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q))
      // The books read first: those are the ones to recommend.
      .sort((a, b) => Number(b.status === "read") - Number(a.status === "read") || a.title.localeCompare(b.title))
      .slice(0, 50);
  }, [books, query]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const book = chosen
      ? { title: chosen.title, author: chosen.author, isbn: chosen.isbn, olWorkId: chosen.olWorkId }
      : { title, author };
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, ...book, note }),
      });
      const data: { error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "That didn’t send. Try again.");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn’t send. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const ready = chosen !== null || (typing && title.trim() && author.trim());

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="dialog dialog--picker recommend"
        role="dialog"
        aria-modal="true"
        aria-label={`Recommend a book to ${name}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="dialog-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <h2 className="confirm-title">{`Recommend a book to ${name}`}</h2>

        {sent ? (
          <>
            <p className="settings-lede">Sent. {name} will see it on their Friends tab.</p>
            <div className="settings-row">
              <button type="button" className="btn btn--primary" onClick={onClose}>
                Done
              </button>
            </div>
          </>
        ) : (
          <form className="recommend-form" onSubmit={send}>
            {chosen ? (
              <div className="recommend-chosen">
                <span>
                  <strong>{chosen.title}</strong> · {chosen.author}
                </span>
                <button type="button" className="btn" onClick={() => setChosen(null)}>
                  Change
                </button>
              </div>
            ) : typing ? (
              <>
                <label className="field">
                  <span>Title</span>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
                </label>
                <label className="field">
                  <span>Author</span>
                  <input type="text" value={author} onChange={(e) => setAuthor(e.target.value)} />
                </label>
                <button type="button" className="recommend-switch" onClick={() => setTyping(false)}>
                  Pick from my library instead
                </button>
              </>
            ) : (
              <>
                <input
                  type="search"
                  className="search picker-search"
                  placeholder="Search your library…"
                  aria-label="Search your library"
                  value={query}
                  autoFocus
                  onChange={(e) => setQuery(e.target.value)}
                />
                {books === null ? (
                  <p className="search-note">
                    <Spinner />
                    Opening your library…
                  </p>
                ) : (
                  <ul className="search-results picker-results">
                    {matches.map((b) => (
                      <li key={b.id}>
                        <button type="button" className="search-result" onClick={() => setChosen(b)}>
                          <span className="search-thumb" style={{ background: paletteFor(b.colorIndex).bg }}>
                            {b.coverImage && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={b.coverImage} alt="" loading="lazy" />
                            )}
                          </span>
                          <span className="search-result-text">
                            <span className="search-result-title">{b.title}</span>
                            <span className="search-result-meta">{b.author}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {books !== null && matches.length === 0 && <p className="search-note">No book in your library matches.</p>}
                <button type="button" className="recommend-switch" onClick={() => setTyping(true)}>
                  It&rsquo;s not in my library: type it in
                </button>
              </>
            )}

            <label className="field">
              <span>A note (if you like)</span>
              <textarea rows={2} maxLength={NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            {error && (
              <p className="settings-note settings-note--error" role="alert">
                {error}
              </p>
            )}
            <div className="settings-row">
              <button type="submit" className="btn btn--primary" disabled={busy || !ready}>
                {busy ? <><Spinner />Sending…</> : "Recommend it"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
