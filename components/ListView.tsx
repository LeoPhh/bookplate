"use client";

import { Book } from "@/lib/types";
import { paletteFor } from "@/lib/palette";
import StarRating from "./StarRating";

interface Props {
  books: Book[];
  onSelect: (id: string) => void;
  marked?: Set<string>; // book ids to flag with the notes bookmark
}

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function ListView({ books, onSelect, marked }: Props) {
  if (books.length === 0) {
    return <p className="empty-note">The shelf is bare — add a book or clear your search.</p>;
  }

  const counts = {
    read: books.filter((b) => b.status === "read").length,
    reading: books.filter((b) => b.status === "reading").length,
    toRead: books.filter((b) => b.status === "to-read").length,
  };

  return (
    <div className="ledger-wrap">
      <table className="ledger">
        <thead>
          <tr>
            <th>Title</th>
            <th>Author</th>
            <th>Genre</th>
            <th>Copy</th>
            <th>Rating</th>
            <th>Finished</th>
          </tr>
        </thead>
        <tbody>
          {books.map((book) => (
            <tr key={book.id} onClick={() => onSelect(book.id)}>
              <td className="ledger-title">
                <span className="ledger-swatch" style={{ background: paletteFor(book.colorIndex).bg }} />
                {book.title}
                {marked?.has(book.id) && <span className="note-ribbon note-ribbon--inline" title="Has notes" />}
              </td>
              <td>{book.author}</td>
              <td>{book.genre ?? "—"}</td>
              <td className="ledger-copy">{book.copy ? "✓" : ""}</td>
              <td>{book.rating > 0 ? <StarRating value={book.rating} size="sm" /> : "—"}</td>
              <td>{fmtDate(book.dateRead)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={6}>
              Count: {books.length} {books.length === 1 ? "volume" : "volumes"} · {counts.read} read ·{" "}
              {counts.reading} reading · {counts.toRead} TBR
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
