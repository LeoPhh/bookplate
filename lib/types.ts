export type BookStatus = "read" | "reading" | "to-read";
// Where the book came from. Kept under the `format` key for data compatibility.
export type BookFormat = "bookstore" | "kindle" | "audiobook" | "borrowed" | "secondhand" | "gifted" | "library";

export interface Book {
  id: string;
  title: string;
  author: string;
  genre?: string;
  pages?: number;
  format?: BookFormat;
  status: BookStatus;
  copy?: boolean; // physical copy owned at home
  rating: number; // 0–5, 0 = unrated
  dateRead?: string; // ISO yyyy-mm-dd
  notes?: string;
  coverImage?: string; // /api/covers/<id>.jpg?v=…; absent = generated cover
  colorIndex: number; // index into PALETTE
  addedAt: string; // ISO timestamp
}

export const STATUS_LABELS: Record<BookStatus, string> = {
  read: "Read",
  reading: "Reading",
  "to-read": "TBR",
};

export interface VocabEntry {
  id: string;
  word: string;
  phonetic?: string; // e.g. /ˈsɒl.ɪ.tjuːd/
  partOfSpeech?: string;
  definition: string;
  example?: string;
  synonyms?: string[];
  bookId?: string; // book the word was learned from
  addedAt: string; // ISO timestamp
}

export const FORMAT_LABELS: Record<BookFormat, string> = {
  bookstore: "Book store",
  kindle: "Kindle",
  audiobook: "Audiobook",
  borrowed: "Borrowed",
  secondhand: "Second hand",
  gifted: "Gifted",
  library: "Library",
};
