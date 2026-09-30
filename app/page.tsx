"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Book } from "@/lib/types";
import { apiFetch, putJson } from "@/lib/api";
import { newId } from "@/lib/id";
import Toolbar, { StatusFilter, ViewMode } from "@/components/Toolbar";
import CoverGrid from "@/components/CoverGrid";
import ListView from "@/components/ListView";
import BookDetail from "@/components/BookDetail";
import BookForm, { CoverAction } from "@/components/BookForm";
import ConfirmDialog from "@/components/ConfirmDialog";
import FinishDialog from "@/components/FinishDialog";
import SiteNav from "@/components/SiteNav";

// Fire-and-forget removal of a stored cover file.
function deleteCoverFile(coverImage: string) {
  void fetch(coverImage.split("?")[0], { method: "DELETE" }).catch(() => {});
}


// Most recently finished first; books without a date finished fall to the end.
function compare(a: Book, b: Book): number {
  return (b.dateRead ?? "").localeCompare(a.dateRead ?? "");
}

export default function Home() {
  const [books, setBooks] = useState<Book[] | null>(null);
  const [view, setView] = useState<ViewMode>("covers");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("read");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [notedFileIds, setNotedFileIds] = useState<string[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Book | null>(null);
  const [pendingFinish, setPendingFinish] = useState<Book | null>(null);

  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);

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

  // Each change is saved as it happens, one book at a time.
  const persist = (request: Promise<Response>) => {
    request
      .then((res) => {
        if (!res.ok) throw new Error();
        setSaveError(false);
      })
      .catch(() => setSaveError(true));
  };
  const saveBook = (book: Book) => persist(putJson(`/api/books/${book.id}`, book));
  const removeBook = (id: string) => persist(apiFetch(`/api/books/${id}`, { method: "DELETE" }));

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
      saveBook(book);
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
        <h1 className="masthead-title">Bookplate</h1>
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
        <SiteNav active="library" />
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
              The last change could not be saved — is the server still running?
            </p>
          )}
        <section className="view-area">
          {view === "covers" && <CoverGrid books={visible} onSelect={setSelectedId} marked={marked} />}
          {view === "list" && <ListView books={visible} onSelect={setSelectedId} marked={marked} />}
        </section>
        </>
      )}

      <footer className="colophon">— ex libris —</footer>

      {selected && !formOpen && (
        <BookDetail
          book={selected}
          hasNotes={noted.has(selected.id)}
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
            setPendingDelete(null);
            setSelectedId(null);
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </main>
  );
}
