"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { VocabEntry } from "@/lib/types";

// A saved word, as a card of fixed size in the vocabulary grids (the
// Vocabulary page and a book's page). Each part gets a set number of lines
// (globals.css, .vocab-card), so one long definition doesn't stretch its
// row; when any of the entry is cut short, "See more" opens the word on
// Wiktionary, where the definitions come from.

interface Props {
  entry: VocabEntry;
  meta?: ReactNode; // "from <book> · <date>", where the card shows one
  onDelete?: () => void;
}

// The word's English entry on Wiktionary (lookups use its API).
export const wiktionaryUrl = (word: string) =>
  `https://en.wiktionary.org/wiki/${encodeURIComponent(word.trim().replace(/ /g, "_"))}#English`;

// Whether any clamped part of the entry hides some of its text (the book's
// title in the last line doesn't count: it's not part of the entry).
function cutShort(card: HTMLElement): boolean {
  const parts = card.querySelectorAll<HTMLElement>("[data-clamp] > :not(.vocab-meta), [data-clamp] .vocab-headword > *");
  return [...parts].some((el) => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1);
}

export default function VocabCard({ entry, meta, onDelete }: Props) {
  const ref = useRef<HTMLLIElement>(null);
  const [truncated, setTruncated] = useState(false);

  // Measured after layout, whenever the card's width changes, and once the
  // web fonts have arrived (they change how much fits).
  useEffect(() => {
    const card = ref.current;
    if (!card) return;
    const measure = () => setTruncated(cutShort(card));
    const observer = new ResizeObserver(measure);
    observer.observe(card);
    void document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, [entry]);

  return (
    <li ref={ref} className={truncated ? "vocab-card vocab-card--more" : "vocab-card"}>
      {onDelete && (
        <button type="button" className="vocab-delete" aria-label={`Remove ${entry.word}`} onClick={onDelete}>
          ✕
        </button>
      )}
      <div className="vocab-card-body" data-clamp>
        <div className="vocab-headword">
          <span className="vocab-word">{entry.word}</span>
          {entry.phonetic && <span className="lookup-phonetic">{entry.phonetic}</span>}
        </div>
        {entry.partOfSpeech && <span className="sense-pos">{entry.partOfSpeech}</span>}
        <p className="vocab-def">{entry.definition}</p>
        {entry.example && <p className="sense-example">“{entry.example}”</p>}
        {entry.synonyms && entry.synonyms.length > 0 && <p className="sense-syn">syn. {entry.synonyms.join(", ")}</p>}
        {meta && <p className="vocab-meta">{meta}</p>}
      </div>
      {truncated && (
        <a
          className="vocab-more"
          href={wiktionaryUrl(entry.word)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`See more about “${entry.word}” on Wiktionary`}
        >
          See more ↗
        </a>
      )}
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
