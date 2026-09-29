"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ListItem } from "@tiptap/extension-list";
import TipTapImage from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "tiptap-markdown";
import { Book, VocabEntry, STATUS_LABELS } from "@/lib/types";
import { compressForNotes } from "@/lib/image";
import { apiFetch, putJson } from "@/lib/api";
import { Callout } from "@/lib/callout";
import BookCover from "@/components/BookCover";
import NotesFormatBar from "@/components/NotesFormatBar";
import StarRating from "@/components/StarRating";

// TipTap ships list items as "paragraph block*", so a bullet's first child has
// to be a paragraph — which makes Callout and Quote silently do nothing when
// the caret sits in a list. Allowing any block lets both wrap a bullet.
const BlockListItem = ListItem.extend({ content: "block+" });

function markdownOf(editor: Editor): string {
  // tiptap-markdown registers its storage at runtime; the base types don't know it.
  return (editor.storage as unknown as { markdown: { getMarkdown(): string } }).markdown.getMarkdown();
}

// Browsers expose pasted/dropped images through either `files` or `items`
// depending on browser and source (screenshot, copied image, Finder file) —
// read both so every path works.
function imageFilesFrom(dt: DataTransfer): File[] {
  const fromFiles = Array.from(dt.files).filter((f) => f.type.startsWith("image/"));
  if (fromFiles.length > 0) return fromFiles;
  return Array.from(dt.items)
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter((f): f is File => f !== null);
}

export default function BookNotesPage() {
  const { id } = useParams<{ id: string }>();
  const [book, setBook] = useState<Book | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [words, setWords] = useState<VocabEntry[]>([]);

  // Markdown loaded from the server (or migrated from the legacy short note).
  const [loadedMd, setLoadedMd] = useState<string | null>(null);
  // Last saved markdown, in the editor's own normalized serialization.
  const savedMdRef = useRef<string>("");
  // The page opens in reading mode; the writing box only appears on Edit.
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Image paths uploaded since the last save — deleted again on Cancel.
  const sessionUploads = useRef<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [booksRes, notesRes, vocabRes] = await Promise.all([
          apiFetch("/api/books"),
          apiFetch("/api/notes/" + id),
          apiFetch("/api/vocabulary"),
        ]);
        if (!booksRes.ok || !notesRes.ok) throw new Error();
        const lib: { books: Book[] | null } = await booksRes.json();
        const notesData: { notes: string | null } = await notesRes.json();
        const vocab: { words: VocabEntry[] | null } = vocabRes.ok ? await vocabRes.json() : { words: null };
        if (cancelled) return;
        const found = lib.books?.find((b) => b.id === id) ?? null;
        if (!found) {
          setNotFound(true);
          return;
        }
        setBook(found);
        // First visit migrates the old short text note into the editor;
        // it becomes the markdown file once saved.
        setLoadedMd(notesData.notes ?? found.notes ?? "");
        setWords((vocab.words ?? []).filter((w) => w.bookId === id));
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // editorProps handlers are created once, so route uploads through a ref.
  const uploadRef = useRef<(files: File[], pos?: number) => void>(() => {});

  // The editor is (re)created once the markdown arrives, with the content
  // parsed at creation. The saved baseline is the editor's own serialization,
  // so "dirty" ignores harmless formatting normalization of the original file.
  const editor = useEditor(
    {
      immediatelyRender: false,
      content: loadedMd ?? "",
      // Reading mode renders through the same editor, just not editable.
      editable: false,
      onCreate: ({ editor }) => {
        savedMdRef.current = markdownOf(editor);
      },
      extensions: [
        StarterKit.configure({ link: { openOnClick: false }, listItem: false }),
        BlockListItem,
        TipTapImage,
        Callout,
        Placeholder.configure({ placeholder: "Write your reading notes — images can be pasted straight in…" }),
        Markdown.configure({ html: false, linkify: true }),
      ],
      editorProps: {
        handlePaste: (_view, event) => {
          const files = event.clipboardData ? imageFilesFrom(event.clipboardData) : [];
          if (files.length === 0) return false; // plain text pastes fall through untouched
          event.preventDefault();
          uploadRef.current(files);
          return true;
        },
        handleDrop: (view, event, _slice, moved) => {
          if (moved || !event.dataTransfer) return false; // internal drags keep default behaviour
          const files = imageFilesFrom(event.dataTransfer);
          if (files.length === 0) return false;
          event.preventDefault();
          const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
          uploadRef.current(files, pos);
          return true;
        },
      },
      onUpdate: ({ editor }) => {
        setDirty(markdownOf(editor) !== savedMdRef.current);
        setSaveError(null);
      },
    },
    [loadedMd]
  );

  const uploadImages = async (files: File[], pos?: number) => {
    if (files.length === 0 || !editor) return;
    setUploading(true);
    setUploadError(null);
    try {
      let insertAt = pos;
      for (const file of files) {
        const blob = await compressForNotes(file);
        const fd = new FormData();
        fd.append("file", blob);
        fd.append("bookId", id);
        try {
          const res = await apiFetch("/api/notes/images", { method: "POST", body: fd });
          if (!res.ok) {
            const data: { error?: string } = await res.json().catch(() => ({}));
            setUploadError(data.error ?? "The image could not be stored.");
            continue;
          }
          const data: { path: string } = await res.json();
          sessionUploads.current.push(data.path);
          // A trailing paragraph puts the caret after the image, so typing
          // right after pasting continues the notes instead of replacing it.
          const content = [{ type: "image", attrs: { src: data.path } }, { type: "paragraph" }];
          if (insertAt != null) {
            editor.chain().insertContentAt(insertAt, content).focus().run();
            insertAt = undefined; // subsequent images follow the first
          } else {
            editor.chain().focus().insertContent(content).run();
          }
        } catch {
          setUploadError("The image could not be stored — is the server still running?");
        }
      }
    } finally {
      setUploading(false);
    }
  };
  useEffect(() => {
    uploadRef.current = uploadImages;
  });

  // The editor follows the mode; entering edit mode puts the caret at the end.
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editing);
    if (editing) editor.commands.focus("end");
  }, [editor, editing]);

  const startEditing = () => {
    setSaved(false);
    setSaveError(null);
    setUploadError(null);
    setEditing(true);
  };

  const save = async () => {
    if (!editor || saving) return;
    const md = markdownOf(editor);
    if (md === savedMdRef.current) {
      setEditing(false); // nothing changed — just put the box away
      return;
    }
    setSaving(true);
    try {
      const res = await putJson("/api/notes/" + id, { notes: md });
      if (!res.ok) throw new Error();
      savedMdRef.current = md;
      sessionUploads.current = []; // the server reconciles stored images on save
      setDirty(false);
      setSaveError(null);
      setSaved(true);
      setEditing(false); // back to reading mode, box gone
    } catch {
      setSaveError("Could not save — is the server still running?");
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    if (!editor) return;
    // Bin images pasted since the last save that the saved text doesn't use.
    for (const path of sessionUploads.current) {
      if (!savedMdRef.current.includes(path)) void fetch(path, { method: "DELETE" }).catch(() => {});
    }
    sessionUploads.current = [];
    editor.commands.setContent(savedMdRef.current); // discard the edits
    setDirty(false); // nothing to warn about — the edits are gone
    setSaveError(null);
    setUploadError(null);
    setEditing(false);
  };

  // Warn before the tab closes with unsaved changes.
  useEffect(() => {
    if (!dirty || !editing) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, editing]);

  const status = uploading
    ? "Storing pasted image…"
    : uploadError ??
      saveError ??
      (saving ? "Saving…" : editing ? (dirty ? "Unsaved changes" : "") : saved ? "Saved" : "");

  if (notFound || loadError) {
    return (
      <main className="page">
        <p className="empty-note">
          {loadError ? "The library could not be opened — is the server still running?" : "This book is no longer on the shelf."}
        </p>
        <p className="ledger-copy">
          <Link className="notes-back" href="/">
            ← Back to the library
          </Link>
        </p>
      </main>
    );
  }

  if (!book || loadedMd === null) {
    return (
      <main className="page">
        <p className="empty-note">Opening the notebook…</p>
      </main>
    );
  }

  return (
    <main className="page page--notes">
      <nav className="notes-breadcrumb">
        <Link className="notes-back" href="/">
          ← Library
        </Link>
      </nav>

      <header className="notes-head">
        <div className="notes-head-cover">
          <BookCover book={book} />
        </div>
        <div className="notes-head-body">
          <p className="detail-kicker">{STATUS_LABELS[book.status]}</p>
          <h1 className="notes-title">{book.title}</h1>
          <p className="detail-author">by {book.author}</p>
          <div className="notes-head-meta">
            {book.rating > 0 && <StarRating value={book.rating} />}
            {book.genre && <span className="notes-meta-item">{book.genre}</span>}
            {book.pages && <span className="notes-meta-item">{book.pages} pages</span>}
          </div>
        </div>
      </header>

      <section className="notes-section">
        <div className="notes-toolbar">
          <h2 className="notes-section-title">Reading notes</h2>
          <span className={uploadError || saveError ? "notes-save notes-save--error" : "notes-save"}>{status}</span>
          {editing ? (
            <>
              <button type="button" className="btn btn--primary" onClick={save} disabled={saving}>
                Save
              </button>
              <button type="button" className="btn" onClick={cancel} disabled={saving}>
                Cancel
              </button>
            </>
          ) : (
            <button type="button" className="btn btn--primary" onClick={startEditing}>
              Edit
            </button>
          )}
        </div>
        {!editing && editor?.isEmpty && (
          <p className="notes-blank">Nothing written yet — press Edit to start these notes.</p>
        )}
        <div
          className={
            editing ? "notes-prose notes-prose--editing" : "notes-prose" + (editor?.isEmpty ? " notes-prose--blank" : "")
          }
        >
          {editing && editor && <NotesFormatBar editor={editor} />}
          <EditorContent editor={editor} />
        </div>
      </section>

      {words.length > 0 && (
        <section className="notes-section">
          <div className="notes-toolbar">
            <h2 className="notes-section-title">Words learned from this book</h2>
            <Link className="notes-vocab-link" href="/vocabulary">
              Look up a new word →
            </Link>
          </div>
          <ul className="vocab-grid">
            {words.map((w) => (
              <li key={w.id} className="vocab-card">
                <div className="vocab-headword">
                  <span className="vocab-word">{w.word}</span>
                  {w.phonetic && <span className="lookup-phonetic">{w.phonetic}</span>}
                </div>
                {w.partOfSpeech && <span className="sense-pos">{w.partOfSpeech}</span>}
                <p className="vocab-def">{w.definition}</p>
                {w.example && <p className="sense-example">“{w.example}”</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="colophon">— marginalia —</footer>
    </main>
  );
}
