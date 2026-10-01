import { createHash } from "crypto";
import { csvRecords } from "./csv";
import { importRecords, listBooks, listNotedBookIds } from "./library";
import { PALETTE } from "./palette";
import { Book, BookFormat, BookStatus } from "./types";

// Imports a library exported from Goodreads ("My Books → Import and export →
// Export Library") or StoryGraph ("Manage Account → Export StoryGraph
// Library"). Both are CSV files; columns are looked up by name.
//
// Re-importing is safe: each row is matched to a book already in the library
// — by the id an earlier import gave it, then ISBN, then title and author —
// and updated in place, keeping its cover, colour and notes.

export type CsvSource = "goodreads" | "storygraph";

export class CsvImportError extends Error {}

interface Row {
  sourceId: string; // stable per row, for matching re-imports
  title: string;
  author: string;
  isbn?: string;
  pages?: number;
  status: BookStatus;
  dnf: boolean;
  rating: number;
  dateRead?: string;
  addedAt?: string;
  format?: BookFormat;
  copy?: boolean;
  review?: string; // Markdown for the book's notes page
}

export interface CsvImportSummary {
  source: CsvSource;
  total: number;
  added: number;
  updated: number;
  read: number;
  reading: number;
  toRead: number;
  dnf: number; // did-not-finish (StoryGraph), imported as TBR
  withIsbn: number; // books a cover can be looked up for
  notes: number; // reviews that become notes pages
  skipped: number; // rows without a title or author
}

// ── Reading the columns ──────────────────────────────────────────────────

function col(r: Record<string, string>, ...names: string[]): string {
  for (const name of names) {
    const key = Object.keys(r).find((k) => k.toLowerCase() === name.toLowerCase());
    if (key && r[key]) return r[key];
  }
  return "";
}

// Goodreads writes ISBNs as ="0123456789" so spreadsheets keep the zeros.
export function cleanIsbn(value: string): string | undefined {
  const digits = value.replace(/[^0-9Xx]/g, "").toUpperCase();
  return digits.length === 10 || digits.length === 13 ? digits : undefined;
}

// "2023/05/14" or "2023-05-14" → "2023-05-14"
export function cleanDate(value: string): string | undefined {
  const m = value.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (!m) return undefined;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

// Bookplate rates in half stars; StoryGraph uses quarters.
function cleanRating(value: string): number {
  const n = parseFloat(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(5, Math.max(0.5, Math.round(n * 2) / 2));
}

// Goodreads appends the series to titles: "Dune (Dune, #1)" → "Dune".
function cleanTitle(value: string): string {
  return value.replace(/\s*\([^()]*#\s*[\d.]+[^()]*\)\s*$/, "").trim();
}

function cleanAuthor(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

// Goodreads reviews are HTML-ish: <br/> for line breaks, a few tags and entities.
function reviewToMarkdown(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(b|strong)>/gi, "**")
    .replace(/<\/?(i|em)>/gi, "*")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function statusFrom(value: string): { status: BookStatus; dnf: boolean } {
  switch (value.trim().toLowerCase()) {
    case "read":
      return { status: "read", dnf: false };
    case "currently-reading":
      return { status: "reading", dnf: false };
    case "did-not-finish":
      return { status: "to-read", dnf: true };
    default:
      return { status: "to-read", dnf: false }; // to-read, or a custom shelf
  }
}

function formatFrom(value: string): BookFormat | undefined {
  const v = value.toLowerCase();
  if (/audio/.test(v)) return "audiobook";
  if (/kindle|ebook|digital/.test(v)) return "kindle";
  return undefined;
}

function hashId(...parts: string[]): string {
  return createHash("sha1").update(parts.join("\u0000")).digest("hex").slice(0, 16);
}

// ── The two formats ──────────────────────────────────────────────────────

export function detectSource(headers: string[]): CsvSource | null {
  const has = (h: string) => headers.some((x) => x.toLowerCase() === h.toLowerCase());
  if (has("Exclusive Shelf") && has("My Rating")) return "goodreads";
  if (has("Read Status") && (has("Star Rating") || has("Authors"))) return "storygraph";
  return null;
}

function goodreadsRow(r: Record<string, string>): Row | null {
  const title = cleanTitle(col(r, "Title"));
  const author = cleanAuthor(col(r, "Author"));
  if (!title || !author) return null;
  const isbn = cleanIsbn(col(r, "ISBN13")) ?? cleanIsbn(col(r, "ISBN"));
  const bookId = col(r, "Book Id").replace(/\D/g, "");
  const pages = parseInt(col(r, "Number of Pages"), 10);
  const review = [col(r, "My Review"), col(r, "Private Notes")].filter(Boolean);
  return {
    sourceId: bookId ? `gr-${bookId}` : `gr-${hashId(isbn ?? "", title, author)}`,
    title,
    author,
    isbn,
    pages: Number.isFinite(pages) && pages > 0 ? pages : undefined,
    ...statusFrom(col(r, "Exclusive Shelf")),
    rating: cleanRating(col(r, "My Rating")),
    dateRead: cleanDate(col(r, "Date Read")),
    addedAt: cleanDate(col(r, "Date Added")),
    format: formatFrom(col(r, "Binding")),
    copy: (parseInt(col(r, "Owned Copies"), 10) || 0) > 0 || undefined,
    review: review.length ? review.map(reviewToMarkdown).join("\n\n---\n\n") : undefined,
  };
}

function storygraphRow(r: Record<string, string>): Row | null {
  const title = cleanTitle(col(r, "Title"));
  const author = cleanAuthor(col(r, "Authors", "Author"));
  if (!title || !author) return null;
  const isbn = cleanIsbn(col(r, "ISBN/UID", "ISBN"));
  const review = col(r, "Review");
  return {
    sourceId: `sg-${hashId(isbn ?? "", title.toLowerCase(), author.toLowerCase())}`,
    title,
    author,
    isbn,
    ...statusFrom(col(r, "Read Status")),
    rating: cleanRating(col(r, "Star Rating")),
    dateRead: cleanDate(col(r, "Last Date Read")) ?? lastDate(col(r, "Dates Read")),
    addedAt: cleanDate(col(r, "Date Added")),
    format: formatFrom(col(r, "Format")),
    copy: /^y/i.test(col(r, "Owned?")) || undefined,
    review: review ? reviewToMarkdown(review) : undefined,
  };
}

// StoryGraph lists every read: "2021/03/02-2021/03/20, 2024/01/05-2024/01/30".
function lastDate(value: string): string | undefined {
  const dates = value.match(/\d{4}[/-]\d{1,2}[/-]\d{1,2}/g);
  return dates ? cleanDate(dates[dates.length - 1]) : undefined;
}

// ── Planning and applying ────────────────────────────────────────────────

const matchKey = (title: string, author: string) =>
  `${cleanTitle(title)}|${author}`.toLowerCase().replace(/[^a-z0-9|]/g, "");

interface Plan {
  summary: CsvImportSummary;
  books: Book[];
  notes: Record<string, string>;
}

async function plan(userId: string, text: string): Promise<Plan> {
  const { headers, records } = csvRecords(text);
  const source = detectSource(headers);
  if (!source) {
    throw new CsvImportError("This doesn't look like a Goodreads or StoryGraph export — no matching columns were found.");
  }

  const existing = await listBooks(userId);
  const byId = new Map(existing.map((b) => [b.id, b]));
  const byIsbn = new Map(existing.filter((b) => b.isbn).map((b) => [b.isbn!, b]));
  const byKey = new Map(existing.map((b) => [matchKey(b.title, b.author), b]));
  const noted = new Set(await listNotedBookIds(userId));

  const summary: CsvImportSummary = {
    source,
    total: 0,
    added: 0,
    updated: 0,
    read: 0,
    reading: 0,
    toRead: 0,
    dnf: 0,
    withIsbn: 0,
    notes: 0,
    skipped: 0,
  };
  const books: Book[] = [];
  const notes: Record<string, string> = {};
  const seen = new Set<string>();

  for (const record of records) {
    const row = source === "goodreads" ? goodreadsRow(record) : storygraphRow(record);
    if (!row) {
      summary.skipped++;
      continue;
    }
    const match =
      byId.get(row.sourceId) ??
      (row.isbn ? byIsbn.get(row.isbn) : undefined) ??
      byKey.get(matchKey(row.title, row.author));
    const id = match ? match.id : row.sourceId;
    if (seen.has(id)) continue; // the same book twice in one file
    seen.add(id);

    // Reading details come from the export; looks (cover, colour, genre,
    // source) and short notes stay as they are on books already here.
    const book: Book = {
      ...(match ?? {}),
      id,
      title: match?.title ?? row.title,
      author: match?.author ?? row.author,
      isbn: row.isbn ?? match?.isbn,
      pages: row.pages ?? match?.pages,
      status: row.status,
      rating: row.rating || match?.rating || 0,
      dateRead: row.dateRead ?? match?.dateRead,
      format: match?.format ?? row.format,
      copy: row.copy ?? match?.copy,
      colorIndex: match?.colorIndex ?? Math.floor(Math.random() * PALETTE.length),
      addedAt: match?.addedAt ?? (row.addedAt ? `${row.addedAt}T00:00:00.000Z` : new Date().toISOString()),
    };
    books.push(book);

    summary.total++;
    if (match) summary.updated++;
    else summary.added++;
    if (book.status === "read") summary.read++;
    else if (book.status === "reading") summary.reading++;
    else summary.toRead++;
    if (row.dnf) summary.dnf++;
    if (book.isbn && !book.coverImage) summary.withIsbn++;
    if (row.review && !noted.has(id)) {
      notes[id] = row.review;
      summary.notes++;
    }
  }

  return { summary, books, notes };
}

// Reads the file and reports what an import would do, without saving.
export async function previewCsvImport(userId: string, text: string): Promise<CsvImportSummary> {
  return (await plan(userId, text)).summary;
}

// Saves the books. Also returns the ids of imported books still without a
// cover, so the Settings page can look covers up for just those.
export async function applyCsvImport(
  userId: string,
  text: string
): Promise<{ summary: CsvImportSummary; coverIds: string[] }> {
  const { summary, books, notes } = await plan(userId, text);
  await importRecords(userId, { books, words: [], notes });
  return { summary, coverIds: books.filter((b) => !b.coverImage).map((b) => b.id) };
}
