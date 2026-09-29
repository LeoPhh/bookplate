import { Book, VocabEntry } from "./types";

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
    optional(o, "format", "string") &&
    optional(o, "copy", "boolean") &&
    optional(o, "dateRead", "string") &&
    optional(o, "notes", "string") &&
    optional(o, "coverImage", "string") &&
    optional(o, "addedAt", "string")
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
