import { CSSProperties } from "react";
import { Book } from "@/lib/types";
import { paletteFor } from "@/lib/palette";

// A rendered front cover, reused by the cover grid and the detail dialog.
// Shows the uploaded photo when one exists, otherwise the generated design.
export default function BookCover({ book }: { book: Book }) {
  if (book.coverImage) {
    return (
      <div className="cover cover--image">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={book.coverImage} alt={`Cover of ${book.title}`} />
      </div>
    );
  }

  const c = paletteFor(book.colorIndex);
  const style = {
    "--spine-bg": c.bg,
    "--spine-deep": c.deep,
    "--spine-ink": c.ink,
  } as CSSProperties;

  return (
    <div className="cover" style={style}>
      <span className="cover-topline">{book.genre ?? " "}</span>
      <span className="cover-title">{book.title}</span>
      <span className="cover-author">{book.author}</span>
    </div>
  );
}
