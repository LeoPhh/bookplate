"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import type { SearchResult } from "@/lib/openLibrary";
import {
  Book,
  BookFormat,
  BookStatus,
  dateLabel,
  FORMAT_LABELS,
  isCustomSource,
  normaliseSource,
  STATUS_LABELS,
} from "@/lib/types";
import { PALETTE } from "@/lib/palette";
import { fileToDataUrl } from "@/lib/image";
import StarRating from "./StarRating";
import DatePicker from "./DatePicker";
import ImageCropper from "./ImageCropper";

// What should happen to the stored cover file when the form is saved.
export type CoverAction = { type: "keep" } | { type: "remove" } | { type: "upload"; blob: Blob };


interface Props {
  book: Book | null; // null = adding a new book
  genres: string[]; // existing genres across the library, for the dropdown
  sources: string[]; // sources readers added themselves, for the dropdown
  onSave: (draft: Omit<Book, "id" | "addedAt" | "coverImage">, cover: CoverAction) => void;
  onClose: () => void;
}

// Sentinel option value that switches the genre dropdown into free-text mode.
const NEW_GENRE = "__new__";
// Same for the source dropdown.
const NEW_SOURCE = "__new_source__";

interface Draft {
  title: string;
  author: string;
  genre: string;
  pages: string;
  format: string; // a built-in source's key, or the reader's own text
  status: BookStatus;
  copy: boolean;
  rating: number;
  dateRead: string;
  colorIndex: number;
  olWorkId: string; // set when a catalogue result is picked
}

function draftFrom(book: Book | null): Draft {
  if (!book) {
    return {
      title: "",
      author: "",
      genre: "",
      pages: "",
      format: "",
      status: "to-read",
      copy: false,
      rating: 0,
      dateRead: "",
      colorIndex: Math.floor(Math.random() * PALETTE.length),
      olWorkId: "",
    };
  }
  return {
    title: book.title,
    author: book.author,
    genre: book.genre ?? "",
    pages: book.pages?.toString() ?? "",
    format: book.format ?? "",
    status: book.status,
    copy: book.copy ?? false,
    rating: book.rating,
    dateRead: book.dateRead ?? "",
    colorIndex: book.colorIndex,
    olWorkId: book.olWorkId ?? "",
  };
}

export default function BookForm({ book, genres, sources, onSave, onClose }: Props) {
  const [d, setD] = useState<Draft>(() => draftFrom(book));
  const [addingGenre, setAddingGenre] = useState(false);
  const [addingSource, setAddingSource] = useState(false);
  const [coverAction, setCoverAction] = useState<CoverAction>({ type: "keep" });
  const [coverPreview, setCoverPreview] = useState<string | null>(book?.coverImage ?? null);
  const [rawImage, setRawImage] = useState<string | null>(null); // selected file awaiting crop
  const fileRef = useRef<HTMLInputElement>(null);

  const [searchQ, setSearchQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [fetchingCover, setFetchingCover] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setD((prev) => ({ ...prev, [key]: value }));

  // Existing genres plus the draft's own value, so an edited book's genre is
  // always selectable even if no other book shares it.
  const genreOptions =
    d.genre && !addingGenre && !genres.includes(d.genre)
      ? [...genres, d.genre].sort((a, b) => a.localeCompare(b))
      : genres;

  // The reader's own sources, plus the draft's own so an edited book's
  // source is always selectable.
  const sourceOptions =
    isCustomSource(d.format) && !addingSource && !sources.includes(d.format)
      ? [...sources, d.format].sort((a, b) => a.localeCompare(b))
      : sources;

  const runSearch = async () => {
    const q = searchQ.trim();
    if (!q || searching) return;
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(`/api/booksearch?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error();
      const data: { results: SearchResult[] } = await res.json();
      setResults(data.results);
      setSearched(true);
    } catch {
      setSearchError("The library catalogue could not be reached — you can still fill things in by hand.");
      setResults([]);
      setSearched(false);
    } finally {
      setSearching(false);
    }
  };

  const applyResult = async (r: SearchResult) => {
    setD((prev) => ({
      ...prev,
      title: r.title,
      author: r.author || prev.author,
      pages: r.pages ? String(r.pages) : prev.pages,
      olWorkId: r.workId ?? prev.olWorkId,
    }));
    setResults([]);
    setSearched(false);
    setSearchQ("");
    setFetchingCover(true);
    try {
      const params = new URLSearchParams({ s: "L", t: r.title, a: r.author });
      if (r.coverId) params.set("id", String(r.coverId));
      const res = await fetch(`/api/booksearch/cover?${params}`);
      if (res.ok) setRawImage(await fileToDataUrl(await res.blob())); // opens the cropper
    } catch {
      // No cover fetched — the generated cover remains.
    } finally {
      setFetchingCover(false);
    }
  };

  const pickFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    try {
      setRawImage(await fileToDataUrl(file));
    } catch {
      // Unreadable file — leave things as they were.
    }
  };

  const [pasteError, setPasteError] = useState<string | null>(null);

  const cropPastedImage = async (blob: Blob) => {
    try {
      setRawImage(await fileToDataUrl(blob)); // opens the cropper
      setPasteError(null);
    } catch {
      setPasteError("That image could not be read.");
    }
  };

  // ⌘V anywhere in the form lands an image in the cropper. Text pastes
  // into fields are untouched.
  const handlePaste = (e: React.ClipboardEvent) => {
    const file =
      Array.from(e.clipboardData.files).find((f) => f.type.startsWith("image/")) ??
      Array.from(e.clipboardData.items)
        .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .find((f): f is File => f !== null);
    if (!file) return;
    e.preventDefault();
    void cropPastedImage(file);
  };

  const cropDone = (blob: Blob) => {
    if (coverPreview?.startsWith("blob:")) URL.revokeObjectURL(coverPreview);
    setCoverAction({ type: "upload", blob });
    setCoverPreview(URL.createObjectURL(blob));
    setRawImage(null);
  };

  const removeCover = () => {
    if (coverPreview?.startsWith("blob:")) URL.revokeObjectURL(coverPreview);
    setCoverAction(book?.coverImage ? { type: "remove" } : { type: "keep" });
    setCoverPreview(null);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!d.title.trim() || !d.author.trim()) return;
    onSave(
      {
        title: d.title.trim(),
        author: d.author.trim(),
        genre: d.genre.trim() || undefined,
        pages: d.pages ? Number(d.pages) : undefined,
        format: normaliseSource(d.format) || undefined,
        status: d.status,
        copy: d.copy || undefined,
        rating: d.rating,
        dateRead: d.dateRead || undefined,
        // Notes are deliberately absent: they live in the book's markdown
        // notes page, and omitting the key preserves any legacy short note.
        colorIndex: d.colorIndex,
        olWorkId: d.olWorkId || undefined,
      },
      coverAction
    );
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="dialog dialog--form"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        onPaste={handlePaste}
      >
        <button type="button" className="dialog-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <h2 className="form-heading">{book ? "Edit book" : "Add a book"}</h2>
        <form onSubmit={submit} className="book-form">
          <div className="field field--wide book-search">
            <span>Find a book</span>
            <div className="search-row">
              <input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    runSearch();
                  }
                }}
                placeholder="Search the Open Library catalogue…"
                autoFocus={!book}
              />
              <button type="button" className="btn" onClick={runSearch} disabled={searching || !searchQ.trim()}>
                {searching ? "Searching…" : "Search"}
              </button>
            </div>
            {searchError && <p className="search-note search-note--error">{searchError}</p>}
            {fetchingCover && <p className="search-note">Fetching the cover…</p>}
            {searched && results.length === 0 && !searchError && (
              <p className="search-note">Nothing found — try a different title, or fill in the details below.</p>
            )}
            {results.length > 0 && (
              <ul className="search-results">
                {results.map((r, i) => (
                  <li key={i}>
                    <button type="button" className="search-result" onClick={() => applyResult(r)}>
                      <span className="search-thumb">
                        <span className="search-thumb-blank">❦</span>
                        {r.coverId && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`/api/booksearch/cover?id=${r.coverId}&s=S`}
                            alt=""
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        )}
                      </span>
                      <span className="search-result-text">
                        <span className="search-result-title">{r.title}</span>
                        <span className="search-result-meta">
                          {[r.author || "Unknown author", r.year, r.pages ? `${r.pages} pp.` : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="search-divider">— or enter the details by hand —</p>
          </div>
          <label className="field field--wide">
            <span>Title *</span>
            <input value={d.title} onChange={(e) => set("title", e.target.value)} required autoFocus={!!book} />
          </label>
          <label className="field field--wide">
            <span>Author *</span>
            <input value={d.author} onChange={(e) => set("author", e.target.value)} required />
          </label>
          <label className="field">
            <span>Status</span>
            <select value={d.status} onChange={(e) => set("status", e.target.value as BookStatus)}>
              {(Object.keys(STATUS_LABELS) as BookStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <div className="field">
            <span>Source</span>
            {addingSource ? (
              <div className="genre-new">
                <input
                  value={d.format}
                  onChange={(e) => set("format", e.target.value)}
                  placeholder="New source"
                  autoFocus
                />
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setAddingSource(false);
                    set("format", "");
                  }}
                  aria-label="Back to the source list"
                  title="Back to the source list"
                >
                  ✕
                </button>
              </div>
            ) : (
              <select
                value={d.format}
                onChange={(e) => {
                  if (e.target.value === NEW_SOURCE) {
                    setAddingSource(true);
                    set("format", "");
                  } else {
                    set("format", e.target.value);
                  }
                }}
              >
                <option value="">—</option>
                {(Object.keys(FORMAT_LABELS) as BookFormat[]).map((f) => (
                  <option key={f} value={f}>
                    {FORMAT_LABELS[f]}
                  </option>
                ))}
                {sourceOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
                <option value={NEW_SOURCE}>＋ Add a source…</option>
              </select>
            )}
          </div>
          <label className="field">
            <span>Pages</span>
            <input type="number" min="1" value={d.pages} onChange={(e) => set("pages", e.target.value)} />
          </label>
          <div className="field">
            <span>Genre</span>
            {addingGenre ? (
              <div className="genre-new">
                <input
                  value={d.genre}
                  onChange={(e) => set("genre", e.target.value)}
                  placeholder="New category"
                  autoFocus
                />
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setAddingGenre(false);
                    set("genre", "");
                  }}
                  aria-label="Back to the category list"
                  title="Back to the category list"
                >
                  ✕
                </button>
              </div>
            ) : (
              <select
                value={d.genre}
                onChange={(e) => {
                  if (e.target.value === NEW_GENRE) {
                    setAddingGenre(true);
                    set("genre", "");
                  } else {
                    set("genre", e.target.value);
                  }
                }}
              >
                <option value="">—</option>
                {genreOptions.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
                <option value={NEW_GENRE}>＋ Add a category…</option>
              </select>
            )}
          </div>
          <div className="field">
            <span>Date {dateLabel(d.status).toLowerCase()}</span>
            <DatePicker value={d.dateRead} onChange={(v) => set("dateRead", v)} />
          </div>
          <div className="field">
            <span>Rating</span>
            <StarRating value={d.rating} onChange={(v) => set("rating", v)} size="lg" />
          </div>
          <div className="field">
            <span>Copy?</span>
            <label className="checkline">
              <input type="checkbox" checked={d.copy} onChange={(e) => set("copy", e.target.checked)} />
              <span>I own a physical copy</span>
            </label>
          </div>
          <div className="field">
            <span>Binding colour</span>
            <div className="swatches">
              {PALETTE.map((c, i) => (
                <button
                  key={c.name}
                  type="button"
                  className={i === d.colorIndex ? "swatch swatch--active" : "swatch"}
                  style={{ background: c.bg }}
                  title={c.name}
                  aria-label={c.name}
                  onClick={() => set("colorIndex", i)}
                />
              ))}
            </div>
          </div>
          <div className="field field--wide">
            <span>Cover image</span>
            <div className="cover-upload">
              <div className="cover-mini">
                {coverPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={coverPreview} alt="Cover preview" />
                ) : (
                  <span>Styled cover</span>
                )}
              </div>
              <div className="cover-upload-actions">
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickFile} />
                <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
                  {coverPreview ? "Replace image…" : "Upload image…"}
                </button>
                {coverPreview && (
                  <button type="button" className="btn btn--danger" onClick={removeCover}>
                    Remove image
                  </button>
                )}
                {pasteError && <p className="search-note search-note--error">{pasteError}</p>}
                <p className="cover-upload-hint">
                  Without an image, the book wears its generated cloth cover. Uploads are cropped to cover
                  proportions and stored with the library.
                </p>
              </div>
            </div>
          </div>
          <p className="field--wide search-note">
            Reading notes — with markdown and pasted images — live on the book’s own notes page, opened from the book’s
            detail view.
          </p>
          <div className="dialog-actions field--wide">
            <button type="submit" className="btn btn--primary">
              {book ? "Save changes" : "Add to shelf"}
            </button>
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
        {rawImage && <ImageCropper imageSrc={rawImage} onConfirm={cropDone} onCancel={() => setRawImage(null)} />}
      </div>
    </div>
  );
}
