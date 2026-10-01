import { Book, ProgressEntry } from "./types";

// Reading-progress maths shared by the covers, the book dialog and the
// statistics page. Dates are the reader's local calendar dates (yyyy-mm-dd).

export function todayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Whole days from one date to another (both yyyy-mm-dd).
export function daysBetween(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

// Pages when the book has a page count, otherwise a percentage.
export function progressUnit(book: Book): "page" | "percent" {
  return book.pages && book.pages > 0 ? "page" : "percent";
}

// The percentage for an entry, recomputed from the page when possible so a
// corrected page count is reflected straight away.
export function entryPercent(book: Book, e: ProgressEntry): number {
  const raw = book.pages && e.page != null ? (e.page / book.pages) * 100 : e.percent;
  return Math.max(0, Math.min(100, raw));
}

export interface ProgressSummary {
  entries: ProgressEntry[]; // oldest first
  unit: "page" | "percent";
  percent: number; // 0–100, rounded
  page?: number; // latest page, for page-tracked books
  started: string; // date of the first update
  daysReading: number; // from the first update until today
  perDay?: number; // pages (or % points) a day, once there are two days of updates
  daysLeft?: number; // at that pace
  readInDays?: number; // for finished books: first update → date finished
}

export function summarize(book: Book, all: ProgressEntry[], today = todayIso()): ProgressSummary | null {
  const entries = all.filter((e) => e.bookId === book.id).sort((a, b) => a.date.localeCompare(b.date));
  if (entries.length === 0) return null;

  const unit = progressUnit(book);
  const first = entries[0];
  const last = entries[entries.length - 1];
  const percent = Math.round(entryPercent(book, last));
  const value = (e: ProgressEntry) => (unit === "page" ? (e.page ?? (e.percent / 100) * book.pages!) : e.percent);

  let perDay: number | undefined;
  let daysLeft: number | undefined;
  const span = daysBetween(first.date, last.date);
  if (span > 0) {
    const gained = value(last) - value(first);
    if (gained > 0) {
      perDay = gained / span;
      const remaining = (unit === "page" ? book.pages! : 100) - value(last);
      daysLeft = remaining > 0 ? Math.ceil(remaining / perDay) : 0;
    }
  }

  const readInDays =
    book.status === "read" && book.dateRead && book.dateRead >= first.date
      ? Math.max(1, daysBetween(first.date, book.dateRead))
      : undefined;

  return {
    entries,
    unit,
    percent,
    page: unit === "page" ? (last.page ?? Math.round(value(last))) : undefined,
    started: first.date,
    daysReading: Math.max(0, daysBetween(first.date, today)),
    perDay,
    daysLeft,
    readInDays,
  };
}

export function fmtShortDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}
