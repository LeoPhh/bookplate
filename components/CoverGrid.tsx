"use client";

import { Book, STATUS_LABELS } from "@/lib/types";
import BookCover from "./BookCover";
import ProgressBar from "./ProgressBar";
import StarRating from "./StarRating";

interface Props {
  books: Book[];
  onSelect: (id: string) => void;
  marked?: Set<string>; // book ids to flag with the notes bookmark
  progress?: Map<string, number>; // book id → percent, for Reading books with updates
}

export default function CoverGrid({ books, onSelect, marked, progress }: Props) {
  if (books.length === 0) {
    return <p className="empty-note">The shelf is bare — add a book or clear your search.</p>;
  }

  return (
    <ul className="cover-grid">
      {books.map((book) => (
        <li key={book.id}>
          <button type="button" className="cover-card" onClick={() => onSelect(book.id)}>
            <span className="cover-wrap">
              <BookCover book={book} />
              {marked?.has(book.id) && <span className="note-ribbon" title="Has notes" />}
            </span>
            <span className="cover-caption">
              {book.status === "reading" && progress?.has(book.id) ? (
                <span className="cover-progress">
                  <ProgressBar percent={progress.get(book.id)!} size="sm" />
                  <span className="cover-progress-value">{progress.get(book.id)}%</span>
                </span>
              ) : book.rating > 0 ? (
                <StarRating value={book.rating} size="sm" />
              ) : (
                <span className="cover-status">{STATUS_LABELS[book.status]}</span>
              )}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
