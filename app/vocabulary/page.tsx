"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Book, VocabEntry } from "@/lib/types";
import SiteNav from "@/components/SiteNav";
import ConfirmDialog from "@/components/ConfirmDialog";
import { apiFetch, putJson } from "@/lib/api";
import { newId } from "@/lib/id";

interface DefineSense {
  partOfSpeech: string;
  definition: string;
  example: string | null;
  synonyms: string[];
}

interface DefineEntry {
  word: string;
  phonetic: string | null;
  senses: DefineSense[];
}

type SortKey = "added" | "word";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

export default function VocabularyPage() {
  const [entries, setEntries] = useState<VocabEntry[] | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [loadError, setLoadError] = useState(false);

  // Lookup panel
  const [lookup, setLookup] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<DefineEntry | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [addedSenses, setAddedSenses] = useState<Set<number>>(new Set());
  const [bookId, setBookId] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualPos, setManualPos] = useState("");
  const [manualDef, setManualDef] = useState("");
  const [manualExample, setManualExample] = useState("");

  // Registry controls
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("added");
  const [bookFilter, setBookFilter] = useState("all");
  const [pendingDelete, setPendingDelete] = useState<VocabEntry | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [vocabRes, booksRes] = await Promise.all([apiFetch("/api/vocabulary"), apiFetch("/api/books")]);
        if (!vocabRes.ok) throw new Error();
        const vocab: { words: VocabEntry[] | null } = await vocabRes.json();
        const lib: { books: Book[] | null } = booksRes.ok ? await booksRes.json() : { books: null };
        if (cancelled) return;
        setEntries(vocab.words ?? []);
        setBooks(lib.books ?? []);
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const bookById = useMemo(() => new Map(books.map((b) => [b.id, b])), [books]);

  const booksAlphabetical = useMemo(
    () => [...books].sort((a, b) => a.title.localeCompare(b.title)),
    [books]
  );

  // Only books that actually have words attached, for the filter dropdown.
  const sourceBooks = useMemo(() => {
    const ids = new Set((entries ?? []).map((e) => e.bookId).filter(Boolean));
    return booksAlphabetical.filter((b) => ids.has(b.id));
  }, [entries, booksAlphabetical]);

  const visible = useMemo(() => {
    if (!entries) return [];
    const q = query.trim().toLowerCase();
    return entries
      .filter((e) => bookFilter === "all" || e.bookId === bookFilter)
      .filter(
        (e) =>
          !q ||
          e.word.toLowerCase().includes(q) ||
          e.definition.toLowerCase().includes(q) ||
          (e.example ?? "").toLowerCase().includes(q)
      )
      .sort((a, b) =>
        sort === "word" ? a.word.localeCompare(b.word) : b.addedAt.localeCompare(a.addedAt)
      );
  }, [entries, query, sort, bookFilter]);

  const stats = useMemo(() => {
    if (!entries || entries.length === 0) return null;
    const monthKey = new Date().toISOString().slice(0, 7);
    const thisMonth = entries.filter((e) => e.addedAt.startsWith(monthKey)).length;
    return { total: entries.length, thisMonth };
  }, [entries]);

  const alreadyKnown = useMemo(() => {
    if (!result || !entries) return false;
    const w = result.word.toLowerCase();
    return entries.some((e) => e.word.toLowerCase() === w);
  }, [result, entries]);

  const resetLookup = () => {
    setResult(null);
    setSearchError(null);
    setAddedSenses(new Set());
    setManualOpen(false);
    setManualPos("");
    setManualDef("");
    setManualExample("");
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const word = lookup.trim();
    if (!word || searching) return;
    resetLookup();
    setSearching(true);
    try {
      const res = await fetch("/api/define?word=" + encodeURIComponent(word));
      if (!res.ok) throw new Error();
      const data: { entry: DefineEntry | null } = await res.json();
      if (data.entry && data.entry.senses.length > 0) {
        setResult(data.entry);
      } else {
        // Not in the dictionary — offer to record it by hand.
        setResult({ word, phonetic: null, senses: [] });
        setManualOpen(true);
      }
    } catch {
      setSearchError("The dictionary could not be reached — try again in a moment.");
    } finally {
      setSearching(false);
    }
  };

  const saveEntry = (draft: Omit<VocabEntry, "id" | "addedAt" | "bookId">) => {
    const entry: VocabEntry = {
      ...draft,
      id: newId(),
      bookId: bookId || undefined,
      addedAt: new Date().toISOString(),
    };
    setEntries((prev) => [entry, ...(prev ?? [])]);
    void putJson(`/api/vocabulary/${entry.id}`, entry).catch(() => {});
  };

  const addSense = (sense: DefineSense, index: number) => {
    if (!result || addedSenses.has(index)) return;
    saveEntry({
      word: result.word,
      phonetic: result.phonetic ?? undefined,
      partOfSpeech: sense.partOfSpeech || undefined,
      definition: sense.definition,
      example: sense.example ?? undefined,
      synonyms: sense.synonyms.length ? sense.synonyms : undefined,
    });
    setAddedSenses((prev) => new Set(prev).add(index));
  };

  const addManual = (e: React.FormEvent) => {
    e.preventDefault();
    const definition = manualDef.trim();
    if (!result || !definition) return;
    saveEntry({
      word: result.word,
      phonetic: result.phonetic ?? undefined,
      partOfSpeech: manualPos.trim() || undefined,
      definition,
      example: manualExample.trim() || undefined,
    });
    setLookup("");
    resetLookup();
  };

  return (
    <main className="page">
      <header className="masthead">
        <p className="masthead-eyebrow">Your Own Personal, Digital Library</p>
        <h1 className="masthead-title">Vocabulary</h1>
        {/* Blank until the words load, like the library masthead: showing the
            invitation first made the line visibly rewrite itself on arrival.
            entries === null is "still loading", [] is a genuinely empty
            lexicon — only the latter gets the invitation. */}
        <p className="masthead-stats">
          {stats ? (
            <>
              {stats.total} {stats.total === 1 ? "word" : "words"} collected
              {stats.thisMonth ? ` · ${stats.thisMonth} this month` : ""}
            </>
          ) : entries ? (
            "Words worth keeping, gathered while reading."
          ) : (
            "\u00A0"
          )}
        </p>
        <SiteNav active="vocabulary" />
      </header>

      <section className="lookup-panel">
        <form className="lookup-form" onSubmit={handleLookup}>
          <input
            type="search"
            className="search"
            placeholder="Type a word you just learned…"
            value={lookup}
            onChange={(e) => setLookup(e.target.value)}
            aria-label="Word to look up"
          />
          <label className="sort-label">
            From
            <select
              className="sort-select"
              value={bookId}
              onChange={(e) => setBookId(e.target.value)}
              aria-label="Book the word came from"
            >
              <option value="">— no book —</option>
              {booksAlphabetical.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn--primary" disabled={searching}>
            {searching ? "Consulting…" : "Look up"}
          </button>
        </form>

        {searchError && <p className="search-note search-note--error">{searchError}</p>}

        {result && (
          <div className="lookup-result">
            <div className="lookup-headword">
              <span className="lookup-word">{result.word}</span>
              {result.phonetic && <span className="lookup-phonetic">{result.phonetic}</span>}
              {alreadyKnown && <span className="badge badge--reading">already in your registry</span>}
            </div>

            {result.senses.length > 0 && (
              <>
                <ol className="sense-list">
                  {result.senses.map((s, i) => (
                    <li key={i} className="sense">
                      <div className="sense-body">
                        {s.partOfSpeech && <span className="sense-pos">{s.partOfSpeech}</span>}
                        <p className="sense-def">{s.definition}</p>
                        {s.example && <p className="sense-example">“{s.example}”</p>}
                        {s.synonyms.length > 0 && (
                          <p className="sense-syn">syn. {s.synonyms.join(", ")}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        className="btn sense-add"
                        disabled={addedSenses.has(i)}
                        onClick={() => addSense(s, i)}
                      >
                        {addedSenses.has(i) ? "Kept ✓" : "+ Keep"}
                      </button>
                    </li>
                  ))}
                </ol>
                {!manualOpen && (
                  <button type="button" className="lookup-manual-link" onClick={() => setManualOpen(true)}>
                    …or write your own definition
                  </button>
                )}
              </>
            )}

            {manualOpen && (
              <form className="manual-form" onSubmit={addManual}>
                {result.senses.length === 0 && (
                  <p className="search-note">
                    The dictionary has no entry for “{result.word}” — record it in your own words.
                  </p>
                )}
                <div className="manual-grid">
                  <label className="field">
                    <span>Part of speech</span>
                    <input
                      value={manualPos}
                      onChange={(e) => setManualPos(e.target.value)}
                      placeholder="noun, verb…"
                    />
                  </label>
                  <label className="field field--wide">
                    <span>Definition</span>
                    <textarea
                      rows={2}
                      value={manualDef}
                      onChange={(e) => setManualDef(e.target.value)}
                      placeholder="What does it mean?"
                    />
                  </label>
                  <label className="field field--wide">
                    <span>Example (optional)</span>
                    <input
                      value={manualExample}
                      onChange={(e) => setManualExample(e.target.value)}
                      placeholder="The sentence where you met it"
                    />
                  </label>
                </div>
                <div className="dialog-actions">
                  <button type="submit" className="btn btn--primary" disabled={!manualDef.trim()}>
                    Keep this word
                  </button>
                  <button type="button" className="btn" onClick={() => (result.senses.length ? setManualOpen(false) : resetLookup())}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </section>

      {entries === null ? (
        <p className="empty-note">
          {loadError ? "The registry could not be opened — is the server still running?" : "Opening the registry…"}
        </p>
      ) : entries.length === 0 ? (
        <p className="empty-note">No words yet — look one up above to begin your lexicon.</p>
      ) : (
        <>
          <div className="toolbar">
            <div className="toolbar-row">
              <input
                type="search"
                className="search"
                placeholder="Search your words…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {sourceBooks.length > 0 && (
                <label className="sort-label">
                  Book
                  <select className="sort-select" value={bookFilter} onChange={(e) => setBookFilter(e.target.value)}>
                    <option value="all">All books</option>
                    {sourceBooks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="sort-label">
                Sort
                <select className="sort-select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                  <option value="added">Recently kept</option>
                  <option value="word">Alphabetical</option>
                </select>
              </label>
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="empty-note">Nothing matches — try another search.</p>
          ) : (
            <ul className="vocab-grid">
              {visible.map((e) => {
                const book = e.bookId ? bookById.get(e.bookId) : undefined;
                return (
                  <li key={e.id} className="vocab-card">
                    <button
                      type="button"
                      className="vocab-delete"
                      aria-label={`Remove ${e.word}`}
                      onClick={() => setPendingDelete(e)}
                    >
                      ✕
                    </button>
                    <div className="vocab-headword">
                      <span className="vocab-word">{e.word}</span>
                      {e.phonetic && <span className="lookup-phonetic">{e.phonetic}</span>}
                    </div>
                    {e.partOfSpeech && <span className="sense-pos">{e.partOfSpeech}</span>}
                    <p className="vocab-def">{e.definition}</p>
                    {e.example && <p className="sense-example">“{e.example}”</p>}
                    {e.synonyms && e.synonyms.length > 0 && <p className="sense-syn">syn. {e.synonyms.join(", ")}</p>}
                    <p className="vocab-meta">
                      {book ? (
                        <>
                          from{" "}
                          <Link className="vocab-book-link" href={`/books/${book.id}`}>
                            <i>{book.title}</i>
                          </Link>{" "}
                          ·{" "}
                        </>
                      ) : null}
                      {formatDate(e.addedAt)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      <footer className="colophon">— lexicon —</footer>

      {pendingDelete && (
        <ConfirmDialog
          title="Forget this word?"
          message={`“${pendingDelete.word}” will be struck from your registry.`}
          confirmLabel="Forget it"
          cancelLabel="Keep it"
          danger
          onConfirm={() => {
            setEntries((prev) => prev!.filter((e) => e.id !== pendingDelete.id));
            void apiFetch(`/api/vocabulary/${pendingDelete.id}`, { method: "DELETE" }).catch(() => {});
            setPendingDelete(null);
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </main>
  );
}
