import { isWorkId } from "./openLibrary";
import { todayIso } from "./progress";
import { Book, ProgressEntry, VocabEntry } from "./types";

const ID_RE = /^[a-zA-Z0-9_-]+$/;

function optional(o: Record<string, unknown>, key: string, type: "string" | "number" | "boolean"): boolean {
  return o[key] === undefined || o[key] === null || typeof o[key] === type;
}

export function isValidBook(b: unknown): b is Book {
  if (typeof b !== "object" || b === null) return false;
  const o = b as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    ID_RE.test(o.id) &&
    typeof o.title === "string" &&
    typeof o.author === "string" &&
    optional(o, "status", "string") &&
    optional(o, "rating", "number") &&
    optional(o, "colorIndex", "number") &&
    optional(o, "pages", "number") &&
    optional(o, "genre", "string") &&
    optional(o, "isbn", "string") &&
    (o.olWorkId === undefined || o.olWorkId === null || isWorkId(o.olWorkId)) &&
    optional(o, "format", "string") &&
    optional(o, "copy", "boolean") &&
    optional(o, "dateRead", "string") &&
    (o.pastReads === undefined || o.pastReads === null || isValidPastReads(o.pastReads)) &&
    optional(o, "notes", "string") &&
    optional(o, "coverImage", "string") &&
    optional(o, "addedAt", "string")
  );
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Earlier reads: a list of { date? }, a few hundred at most.
function isValidPastReads(v: unknown): boolean {
  if (!Array.isArray(v) || v.length > 500) return false;
  return v.every((r) => {
    if (typeof r !== "object" || r === null) return false;
    const date = (r as Record<string, unknown>).date;
    return date === undefined || (typeof date === "string" && DATE_RE.test(date));
  });
}

// A finished date can't be in the future. Measured against the server's
// tomorrow, so a reader whose day has already turned over isn't refused.
export function isFutureDate(iso: string, now = new Date()): boolean {
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return iso > todayIso(tomorrow);
}

export function isValidProgress(p: unknown): p is ProgressEntry {
  if (typeof p !== "object" || p === null) return false;
  const o = p as Record<string, unknown>;
  return (
    typeof o.bookId === "string" &&
    ID_RE.test(o.bookId) &&
    typeof o.date === "string" &&
    DATE_RE.test(o.date) &&
    typeof o.percent === "number" &&
    Number.isFinite(o.percent) &&
    o.percent >= 0 &&
    o.percent <= 100 &&
    (o.page === undefined || o.page === null || (Number.isInteger(o.page) && (o.page as number) >= 0))
  );
}

export function isValidVocab(w: unknown): w is VocabEntry {
  if (typeof w !== "object" || w === null) return false;
  const o = w as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    ID_RE.test(o.id) &&
    typeof o.word === "string" &&
    typeof o.definition === "string" &&
    optional(o, "phonetic", "string") &&
    optional(o, "partOfSpeech", "string") &&
    optional(o, "example", "string") &&
    optional(o, "bookId", "string") &&
    optional(o, "addedAt", "string") &&
    (o.synonyms === undefined || (Array.isArray(o.synonyms) && o.synonyms.every((s) => typeof s === "string")))
  );
}
