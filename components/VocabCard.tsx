import Link from "next/link";
import type { ReactNode } from "react";
import type { VocabEntry } from "@/lib/types";

// A saved word, as a card in the vocabulary grids (the Vocabulary page and a
// book's page). Each card is as tall as its entry; the grid packs them into
// columns (globals.css, .vocab-grid).

interface Props {
  entry: VocabEntry;
  meta?: ReactNode; // "from <book> · <date>", where the card shows one
  onDelete?: () => void;
}

export default function VocabCard({ entry, meta, onDelete }: Props) {
  return (
    <li className="vocab-card">
      {onDelete && (
        <button type="button" className="vocab-delete" aria-label={`Remove ${entry.word}`} onClick={onDelete}>
          ✕
        </button>
      )}
      <div className="vocab-headword">
        <span className="vocab-word">{entry.word}</span>
        {entry.phonetic && <span className="lookup-phonetic">{entry.phonetic}</span>}
      </div>
      {entry.partOfSpeech && <span className="sense-pos">{entry.partOfSpeech}</span>}
      <p className="vocab-def">{entry.definition}</p>
      {entry.example && <p className="sense-example">“{entry.example}”</p>}
      {entry.synonyms && entry.synonyms.length > 0 && <p className="sense-syn">syn. {entry.synonyms.join(", ")}</p>}
      {meta && <p className="vocab-meta">{meta}</p>}
    </li>
  );
}

// "from <book> · <date>" for a card, the book linking to its page.
export function vocabMeta(book: { id: string; title: string } | undefined, date: string): ReactNode {
  return (
    <>
      {book && (
        <>
          from{" "}
          <Link className="vocab-book-link" href={`/books/${book.id}`}>
            <i>{book.title}</i>
          </Link>{" "}
          ·{" "}
        </>
      )}
      {date}
    </>
  );
}
