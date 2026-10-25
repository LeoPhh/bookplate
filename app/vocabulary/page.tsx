"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Book, VocabEntry } from "@/lib/types";
import BookPicker from "@/components/BookPicker";
import ConfirmDialog from "@/components/ConfirmDialog";
import Hint from "@/components/Hint";
import VocabCard, { vocabMeta } from "@/components/VocabCard";
import { apiFetch, putJson } from "@/lib/api";
import { newId } from "@/lib/id";
import Spinner from "@/components/Spinner";

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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [addedSenses, setAddedSenses] = useState<Set<number>>(new Set());
  const [bookId, setBookId] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualPos, setManualPos] = useState("");
  const [manualDef, setManualDef] = useState("");
  const [manualExample, setManualExample] = useState("");

  // Registry controls
  const [query, setQuery] = useState("");
  // Searching your words starts from the magnifier in the filter row.
  const [searchOpen, setSearchOpen] = useState(false);
  const closeSearch = () => {
    setQuery("");
    setSearchOpen(false);
  };
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

  // Closing the results also clears the word looked up.
  const closeLookup = () => {
    resetLookup();
    setLookup("");
  };

  // The results close with Escape or a click anywhere outside the lookup
  // panel — except while writing a definition of your own, so a stray click
  // can't throw it away.
  const panelRef = useRef<HTMLElement>(null);
  const writing = manualOpen && Boolean(manualDef.trim() || manualPos.trim() || manualExample.trim());
  useEffect(() => {
    if (!result || pendingDelete) return;
    const onPointer = (e: PointerEvent) => {
      if (!writing && panelRef.current && !panelRef.current.contains(e.target as Node)) closeLookup();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !writing) closeLookup();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
    // closeLookup only sets state, so it needn't be a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, pendingDelete, writing]);

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
      setSearchError("The dictionary could not be reached. Try again in a moment.");
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
    setSaveError(null);
    void putJson(`/api/vocabulary/${entry.id}`, entry)
      .then(async (res) => {
        if (res.ok) return;
        // Refused (e.g. this server's word limit): take the word back off the list.
        const data: { error?: string } = await res.json().catch(() => ({}));
        setEntries((prev) => prev?.filter((e) => e.id !== entry.id) ?? prev);
        setSaveError(data.error ?? "The word could not be saved.");
      })
      .catch(() => setSaveError("The word could not be saved. Is the server still running?"));
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
      </header>

      <Hint id="vocabulary" title="What is the vocabulary registry?">
        <p>
          A place for the words you meet while reading. Look one up, keep the meaning that fits and note the book it
          came from. Your words gather here to search and revisit, and each book’s page lists the words it taught you.
        </p>
      </Hint>

      <section className="lookup-panel" ref={panelRef}>
        <form className="lookup-form" onSubmit={handleLookup}>
          <input
            type="search"
            className="search"
            placeholder="Type a word you just learned…"
            value={lookup}
            onChange={(e) => setLookup(e.target.value)}
            aria-label="Word to look up"
          />
          <div className="sort-label">
            From
            <button
              type="button"
              className="book-pick"
              aria-label={`Book the word came from: ${bookById.get(bookId)?.title ?? "no book"}`}
              aria-haspopup="dialog"
              onClick={() => setPickerOpen(true)}
            >
              <span className="book-pick-title">{bookById.get(bookId)?.title ?? "No book"}</span>
              <svg viewBox="0 0 12 12" aria-hidden="true">
                <path d="M2.5 4.5 6 8l3.5-3.5" />
              </svg>
            </button>
          </div>
          <button type="submit" className="btn btn--primary" disabled={searching}>
            {searching ? <><Spinner />Consulting…</> : "Look up"}
          </button>
        </form>

        {/* Inside the panel, so picking a book doesn't count as a click
            outside it and close the lookup results. */}
        {pickerOpen && (
          <BookPicker books={books} selectedId={bookId} onSelect={setBookId} onClose={() => setPickerOpen(false)} />
        )}

        {searchError && <p className="search-note search-note--error">{searchError}</p>}
        {saveError && (
          <p className="search-note search-note--error" role="alert">
            {saveError}
          </p>
        )}

        {result && (
          <div className="lookup-result">
            <button type="button" className="dialog-close lookup-close" onClick={closeLookup} aria-label="Close the results">
              ✕
            </button>
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
                    The dictionary has no entry for “{result.word}”. Record it in your own words.
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
          {loadError ? "The registry could not be opened. Is the server still running?" : <><Spinner />Opening the registry…</>}
        </p>
      ) : entries.length === 0 ? (
        <p className="empty-note">No words yet. Look one up above to begin your lexicon.</p>
      ) : (
        <>
          <div className="toolbar">
            <div className="toolbar-row vocab-filters">
              {searchOpen ? (
                <div className="vocab-search">
                  <input
                    type="text"
                    enterKeyHint="search"
                    className="search"
                    placeholder="Search your words…"
                    aria-label="Search your words"
                    value={query}
                    autoFocus
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Escape" && closeSearch()}
                    onBlur={() => !query.trim() && setSearchOpen(false)}
                  />
                  <button
                    type="button"
                    className="vocab-search-close"
                    aria-label="Close the search"
                    // Before the input's blur, so the click isn't lost.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={closeSearch}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn vocab-search-toggle"
                  aria-label="Search your words"
                  title="Search your words"
                  onClick={() => setSearchOpen(true)}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                    <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
                    <path d="M15.5 15.5 21 21" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" />
                  </svg>
                </button>
              )}
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
              <label className="sort-label vocab-sort">
                Sort
                <select className="sort-select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                  <option value="added">Recently kept</option>
                  <option value="word">Alphabetical</option>
                </select>
              </label>
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="empty-note">Nothing matches. Try another search.</p>
          ) : (
            <ul className="vocab-grid">
              {visible.map((e) => {
                const book = e.bookId ? bookById.get(e.bookId) : undefined;
                return (
                  <VocabCard
                    key={e.id}
                    entry={e}
                    meta={vocabMeta(book, formatDate(e.addedAt))}
                    onDelete={() => setPendingDelete(e)}
                  />
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
