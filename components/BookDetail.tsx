"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Book, FORMAT_LABELS, ProgressEntry, STATUS_LABELS } from "@/lib/types";
import { plural, summarize } from "@/lib/progress";
import BookCover from "./BookCover";
import ProgressPanel from "./ProgressPanel";
import StarRating from "./StarRating";

interface Props {
  book: Book;
  hasNotes: boolean;
  progress: ProgressEntry[];
  onLogProgress: (entry: ProgressEntry) => void;
  onRemoveProgress: (date: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onFinish: () => void;
  onClose: () => void;
}

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Yes/no facts read as a tick or a cross rather than a word or a dash.
function Flag({ on }: { on: boolean }) {
  return (
    <span className={on ? "fact-flag fact-flag--yes" : "fact-flag fact-flag--no"} role="img" aria-label={on ? "Yes" : "No"}>
      {on ? "✓" : "✕"}
    </span>
  );
}

export default function BookDetail({
  book,
  hasNotes,
  progress,
  onLogProgress,
  onRemoveProgress,
  onEdit,
  onDelete,
  onFinish,
  onClose,
}: Props) {
  // For finished books whose reading was tracked: how long it took.
  const readInDays = book.status === "read" ? summarize(book, progress)?.readInDays : undefined;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog dialog--detail" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="dialog-edit"
          onClick={onEdit}
          aria-label="Edit book details"
          title="Edit book details"
        >
          <svg
            viewBox="0 0 16 16"
            width="15"
            height="15"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M11.2 2.3a1.45 1.45 0 0 1 2.05 2.05l-7.2 7.2-2.8.75.75-2.8 7.2-7.2Z" />
            <path d="M10.05 3.45l2.05 2.05" />
          </svg>
        </button>
        <button type="button" className="dialog-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <div className="detail-layout">
          <div className="detail-cover">
            <BookCover book={book} />
          </div>
          <div className="detail-body">
            <p className="detail-kicker">{STATUS_LABELS[book.status]}</p>
            <h2 className="detail-title">{book.title}</h2>
            <p className="detail-author">by {book.author}</p>
            <div className="detail-rating">
              {book.rating > 0 ? <StarRating value={book.rating} size="lg" /> : <span className="muted">Not yet rated</span>}
            </div>
            <dl className="detail-facts">
              <div>
                <dt>Genre</dt>
                <dd>{book.genre ?? "—"}</dd>
              </div>
              <div>
                <dt>Pages</dt>
                <dd>{book.pages ?? "—"}</dd>
              </div>
              <div>
                <dt>Source</dt>
                {/* older records may hold retired format values — show a dash */}
                <dd>{(book.format && FORMAT_LABELS[book.format]) || "—"}</dd>
              </div>
              <div>
                <dt>Copy</dt>
                <dd>
                  <Flag on={!!book.copy} />
                </dd>
              </div>
              <div>
                <dt>Finished</dt>
                <dd>{fmtDate(book.dateRead)}</dd>
              </div>
              <div>
                <dt>Notes</dt>
                <dd>
                  <Flag on={hasNotes} />
                </dd>
              </div>
              {readInDays !== undefined && (
                <div>
                  <dt>Read in</dt>
                  <dd>{plural(readInDays, "day")}</dd>
                </div>
              )}
            </dl>
            {book.status === "reading" && (
              <ProgressPanel
                book={book}
                progress={progress}
                onLog={onLogProgress}
                onRemove={onRemoveProgress}
                onFinish={onFinish}
              />
            )}
            <div className="dialog-actions">
              {book.status !== "read" && (
                <button type="button" className="btn btn--primary" onClick={onFinish}>
                  Finished Reading
                </button>
              )}
              <Link className="btn btn--accent" href={`/books/${book.id}`}>
                Notes
              </Link>
              <button type="button" className="btn btn--danger" onClick={onDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
