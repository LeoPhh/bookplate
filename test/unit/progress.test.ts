import { describe, expect, it } from "vitest";
import { daysBetween, entryPercent, progressUnit, summarize, todayIso } from "@/lib/progress";
import { Book, ProgressEntry } from "@/lib/types";

const book = (over: Partial<Book> = {}): Book => ({
  id: "b",
  title: "T",
  author: "A",
  status: "reading",
  rating: 0,
  colorIndex: 0,
  addedAt: "2026-01-01T00:00:00Z",
  ...over,
});
const entry = (date: string, page: number | undefined, percent: number): ProgressEntry => ({
  bookId: "b",
  date,
  page,
  percent,
});

describe("dates", () => {
  it("counts whole days, across month ends", () => {
    expect(daysBetween("2026-09-28", "2026-10-02")).toBe(4);
    expect(daysBetween("2026-10-02", "2026-10-02")).toBe(0);
  });

  it("formats today as a local date", () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });
});

describe("summarize", () => {
  it("returns null without updates", () => {
    expect(summarize(book(), [])).toBeNull();
  });

  it("works out pages, pace and days left", () => {
    const b = book({ pages: 300 });
    const s = summarize(b, [entry("2026-09-19", 40, 13.3), entry("2026-10-01", 216, 72)], "2026-10-01")!;
    expect(s.unit).toBe("page");
    expect(s.page).toBe(216);
    expect(s.percent).toBe(72);
    expect(s.started).toBe("2026-09-19");
    expect(s.daysReading).toBe(12);
    expect(s.perDay).toBeCloseTo(176 / 12);
    expect(s.daysLeft).toBe(Math.ceil(84 / (176 / 12)));
  });

  it("needs updates on two different days before it shows a pace", () => {
    const s = summarize(book({ pages: 300 }), [entry("2026-10-01", 50, 16.7)], "2026-10-01")!;
    expect(s.perDay).toBeUndefined();
    expect(s.daysLeft).toBeUndefined();
    expect(s.daysReading).toBe(0);
  });

  it("uses percentages for books without a page count", () => {
    const s = summarize(book({ format: "kindle" }), [entry("2026-09-27", undefined, 20), entry("2026-10-01", undefined, 37)], "2026-10-01")!;
    expect(s.unit).toBe("percent");
    expect(s.percent).toBe(37);
    expect(s.perDay).toBeCloseTo(17 / 4);
  });

  it("reports how long a finished book took", () => {
    const b = book({ status: "read", pages: 658, dateRead: "2026-09-29" });
    const s = summarize(b, [entry("2026-09-11", 50, 7.6), entry("2026-09-28", 640, 97.3)])!;
    expect(s.readInDays).toBe(18);
  });

  it("ignores other books' updates", () => {
    expect(summarize(book(), [{ bookId: "other", date: "2026-10-01", percent: 50 }])).toBeNull();
  });
});

describe("entryPercent and progressUnit", () => {
  it("recomputes from the page so a corrected page count shows at once", () => {
    expect(entryPercent(book({ pages: 200 }), entry("2026-10-01", 100, 33))).toBe(50);
    expect(entryPercent(book(), entry("2026-10-01", undefined, 140))).toBe(100);
  });

  it("tracks pages only when there is a page count", () => {
    expect(progressUnit(book({ pages: 10 }))).toBe("page");
    expect(progressUnit(book())).toBe("percent");
  });
});
