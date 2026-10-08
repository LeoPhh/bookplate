"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Book, isCustomSource, ProgressEntry } from "@/lib/types";
import { summarize } from "@/lib/progress";
import { apiFetch, putJson } from "@/lib/api";
import { newId } from "@/lib/id";
import Toolbar, { StatusFilter, ViewMode } from "@/components/Toolbar";
import CoverGrid from "@/components/CoverGrid";
import ListView from "@/components/ListView";
import BookDetail from "@/components/BookDetail";
import BookForm, { CoverAction } from "@/components/BookForm";
import ConfirmDialog from "@/components/ConfirmDialog";
import FinishDialog from "@/components/FinishDialog";

// Fire-and-forget removal of a stored cover file.
function deleteCoverFile(coverImage: string) {
  void fetch(coverImage.split("?")[0], { method: "DELETE" }).catch(() => {});
}


// Books on the go come first, so a book you've just added is easy to find:
// Reading, then TBR (newest added first), then Read — most recently finished
// first, with read books missing a finish date (common in imports) at the end
// — then the books you didn't finish, most recently stopped first.
const STATUS_ORDER: Record<Book["status"], number> = { reading: 0, "to-read": 1, read: 2, dnf: 3 };

function compare(a: Book, b: Book): number {
  const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
  if (byStatus !== 0) return byStatus;
  if (a.status === "read" || a.status === "dnf") {
    const byFinished = (b.dateRead ?? "").localeCompare(a.dateRead ?? "");
    if (byFinished !== 0) return byFinished;
  }
  return (b.addedAt ?? "").localeCompare(a.addedAt ?? "");
}

export default function Home() {
  const [books, setBooks] = useState<Book[] | null>(null);
  const [view, setView] = useState<ViewMode>("covers");
  const [query, setQuery] = useState("");
  // "All" by default, so a newly added book always shows up straight away.
  const [status, setStatus] = useState<StatusFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [notedFileIds, setNotedFileIds] = useState<string[]>([]);
  const [progress, setProgress] = useState<ProgressEntry[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Book | null>(null);
  const [pendingFinish, setPendingFinish] = useState<Book | null>(null);

  const [loadError, setLoadError] = useState(false);
  // Why the last change wasn't saved, shown above the library.
  const [saveError, setSaveError] = useState<string | null>(null);

  const router = useRouter();

  // Load the signed-in user's library from the server.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/books");
        if (!res.ok) throw new Error();
        const data: { books: Book[] } = await res.json();
        if (cancelled) return;
        const loaded = data.books;
        // Older data may lack a status — treat those books as TBR.
        setBooks(loaded.map((b) => (b.status ? b : { ...b, status: "to-read" })));
        // A book selected on the Statistics page arrives as ?book=<id>; open
        // its detail now that the library is loaded, then strip the param so
        // a refresh starts clean. (Read here, not via useSearchParams, to
        // keep the route statically prerenderable.)
        if (typeof window !== "undefined") {
          const id = new URLSearchParams(window.location.search).get("book");
          if (id && loaded.some((b) => b.id === id)) {
            setSelectedId(id);
            router.replace("/");
          }
        }
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();
    // Reading-progress updates — for the cover bars and the book dialog.
    (async () => {
      try {
        const res = await apiFetch("/api/progress");
        if (!res.ok) return;
        const data: { progress: ProgressEntry[] } = await res.json();
        if (!cancelled) setProgress(data.progress);
      } catch {
        // The library works without it; the bars just don't show.
      }
    })();
    // Which books have notes files — used by the "Show notes" toggle.
    (async () => {
      try {
        const res = await apiFetch("/api/notes");
        if (!res.ok) return;
        const data: { ids: string[] } = await res.json();
        if (!cancelled) setNotedFileIds(data.ids);
      } catch {
        // Marker data is cosmetic — the library works without it.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Each change is saved as it happens, one book at a time. A refusal from
  // the server (e.g. a library at this server's book limit) explains itself;
  // `onRefused` undoes the change on screen.
  const persist = (request: Promise<Response>, onRefused?: () => void) => {
    request
      .then(async (res) => {
        if (res.ok) return setSaveError(null);
        const data: { error?: string } = await res.json().catch(() => ({}));
        if (res.status === 403 && data.error) {
          onRefused?.();
          return setSaveError(data.error);
        }
        // The server's log has the details under this request's ID.
        const ref = res.headers.get("x-request-id")?.slice(0, 8);
        setSaveError(`The last change could not be saved${ref ? ` (reference ${ref})` : ""}.`);
      })
      .catch(() => setSaveError("The last change could not be saved — is the server still running?"));
  };
  const saveBook = (book: Book, onRefused?: () => void) => persist(putJson(`/api/books/${book.id}`, book), onRefused);
  const removeBook = (id: string) => persist(apiFetch(`/api/books/${id}`, { method: "DELETE" }));

  // One update per book per day: a second one the same day replaces it.
  const logProgress = (entry: ProgressEntry) => {
    setProgress((prev) => [...prev.filter((e) => !(e.bookId === entry.bookId && e.date === entry.date)), entry]);
    persist(putJson(`/api/progress/${entry.bookId}`, entry));
  };
  const removeProgress = (bookId: string, date: string) => {
    setProgress((prev) => prev.filter((e) => !(e.bookId === bookId && e.date === date)));
    persist(apiFetch(`/api/progress/${bookId}?date=${date}`, { method: "DELETE" }));
  };

  // Percent read for each Reading book with updates, for the cover bars.
  const coverProgress = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of books ?? []) {
      if (b.status !== "reading") continue;
      const s = summarize(b, progress);
      if (s) m.set(b.id, s.percent);
    }
    return m;
  }, [books, progress]);

  const visible = useMemo(() => {
    if (!books) return [];
    const q = query.trim().toLowerCase();
    return books
      .filter((b) => status === "all" || b.status === status)
      .filter(
        (b) =>
          !q ||
          b.title.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q) ||
          (b.genre ?? "").toLowerCase().includes(q) ||
          (b.notes ?? "").toLowerCase().includes(q)
      )
      .sort(compare);
  }, [books, query, status]);

  const selected = books?.find((b) => b.id === selectedId) ?? null;

  // Books with a notes file, plus legacy short notes still stored in the library.
  const noted = useMemo(() => {
    const s = new Set(notedFileIds);
    for (const b of books ?? []) {
      if (b.notes?.trim()) s.add(b.id);
    }
    return s;
  }, [notedFileIds, books]);
  const marked = showNotes ? noted : undefined;

  const genres = useMemo(() => {
    const set = new Set<string>();
    for (const b of books ?? []) {
      const g = b.genre?.trim();
      if (g) set.add(g);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [books]);

  // The sources readers added themselves, for the form's dropdown.
  const sources = useMemo(() => {
    const set = new Set<string>();
    for (const b of books ?? []) {
      if (isCustomSource(b.format)) set.add(b.format);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [books]);

  const stats = useMemo(() => {
    if (!books || books.length === 0) return null;
    const read = books.filter((b) => b.status === "read");
    const rated = books.filter((b) => b.rating > 0);
    const avg = rated.length ? (rated.reduce((s, b) => s + b.rating, 0) / rated.length).toFixed(1) : null;
    return { total: books.length, read: read.length, avg };
  }, [books]);

  const handleSave = async (draft: Omit<Book, "id" | "addedAt" | "coverImage">, cover: CoverAction) => {
    const id = editing?.id ?? newId();
    let coverImage = editing?.coverImage;
    try {
      if (cover.type === "upload") {
        const fd = new FormData();
        fd.append("file", cover.blob, "cover.jpg");
        fd.append("id", id);
        const res = await apiFetch("/api/covers", { method: "POST", body: fd });
        if (res.ok) {
          const data: { path: string } = await res.json();
          coverImage = `${data.path}?v=${Date.now()}`;
        } else {
          const data: { error?: string } = await res.json().catch(() => ({}));
          setSaveError(data.error ?? "The cover could not be saved.");
        }
      } else if (cover.type === "remove" && coverImage) {
        deleteCoverFile(coverImage);
        coverImage = undefined;
      }
    } catch {
      // Upload failed — save the book anyway with its previous cover.
    }
    if (editing) {
      const book: Book = { ...editing, ...draft, coverImage };
      setBooks((prev) => prev!.map((b) => (b.id === editing.id ? book : b)));
      saveBook(book);
    } else {
      const book: Book = { ...draft, coverImage, id, addedAt: new Date().toISOString() };
      setBooks((prev) => [book, ...(prev ?? [])]);
      saveBook(book, () => setBooks((prev) => prev!.filter((b) => b.id !== id)));
    }
    setFormOpen(false);
    setEditing(null);
  };

  const handleDelete = (id: string) => {
    const book = books?.find((b) => b.id === id);
    if (book) setPendingDelete(book);
  };

  return (
    <main className="page">
      <header className="masthead">
        <p className="masthead-eyebrow">Your Own Personal, Digital Library</p>
        <h1 className="masthead-title">Library</h1>
        {/* Always rendered, blank until the library loads: dropping the line
            collapsed the masthead for a frame and jolted the whole page. */}
        <p className="masthead-stats">
          {stats ? (
            <>
              {stats.total} {stats.total === 1 ? "volume" : "volumes"} · {stats.read} read
              {stats.avg ? ` · ★ ${stats.avg} average` : ""}
            </>
          ) : (
            "\u00A0"
          )}
        </p>
      </header>

      <Toolbar
        view={view}
        onView={setView}
        query={query}
        onQuery={setQuery}
        status={status}
        onStatus={setStatus}
        showNotes={showNotes}
        onShowNotes={setShowNotes}
        onAdd={() => {
          setEditing(null);
          setFormOpen(true);
        }}
      />

      {books === null ? (
        <p className="empty-note">
          {loadError ? "The library could not be opened — is the server still running?" : "Opening the library…"}
        </p>
      ) : (
        <>
          {saveError && (
            <p className="empty-note" role="alert">
              {saveError}
            </p>
          )}
        <section className="view-area">
          {view === "covers" && (
            <CoverGrid books={visible} onSelect={setSelectedId} marked={marked} progress={coverProgress} />
          )}
          {view === "list" && <ListView books={visible} onSelect={setSelectedId} marked={marked} />}
        </section>
        </>
      )}

      <footer className="colophon">— ex libris —</footer>

      {selected && !formOpen && (
        <BookDetail
          book={selected}
          hasNotes={noted.has(selected.id)}
          progress={progress}
          onLogProgress={logProgress}
          onRemoveProgress={(date) => removeProgress(selected.id, date)}
          onEdit={() => {
            setEditing(selected);
            setFormOpen(true);
          }}
          onDelete={() => handleDelete(selected.id)}
          onFinish={() => setPendingFinish(selected)}
          onClose={() => setSelectedId(null)}
        />
      )}

      {formOpen && (
        <BookForm
          book={editing}
          genres={genres}
          sources={sources}
          onSave={handleSave}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
        />
      )}

      {pendingFinish && (
        <FinishDialog
          book={pendingFinish}
          onConfirm={(dateRead, rating) => {
            const book: Book = { ...pendingFinish, status: "read", dateRead, rating };
            setBooks((prev) => prev!.map((b) => (b.id === book.id ? book : b)));
            saveBook(book);
            setPendingFinish(null);
          }}
          onCancel={() => setPendingFinish(null)}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Remove this book?"
          message={`“${pendingDelete.title}” by ${pendingDelete.author} will be taken off your shelf.`}
          confirmLabel="Remove"
          cancelLabel="Keep it"
          danger
          onConfirm={() => {
            // The server removes the cover, notes and pasted images with it.
            removeBook(pendingDelete.id);
            setBooks((prev) => prev!.filter((b) => b.id !== pendingDelete.id));
            setProgress((prev) => prev.filter((e) => e.bookId !== pendingDelete.id));
            setPendingDelete(null);
            setSelectedId(null);
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </main>
  );
}
