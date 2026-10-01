import { describe, expect, it } from "vitest";
import { book, reader } from "./client";
import type { ProgressEntry } from "@/lib/types";

describe("reading progress", () => {
  it("keeps one update per book per day and validates updates", async () => {
    const r = await reader();
    await r.json("/api/books/b1", "PUT", book("b1", { status: "reading", pages: 300 }));
    const log = (body: unknown) => r.json("/api/progress/b1", "PUT", body);

    expect((await log({ date: "2026-09-20", page: 40, percent: 13.3 })).status).toBe(200);
    expect((await log({ date: "2026-10-01", page: 214, percent: 71.3 })).status).toBe(200);
    expect((await log({ date: "2026-10-01", page: 216, percent: 72 })).status).toBe(200); // replaces today's

    expect((await log({ date: "2026-10-01", page: 400, percent: 100 })).status).toBe(400); // past the last page
    expect((await log({ date: "2026-10-01", percent: 140 })).status).toBe(400);
    expect((await log({ date: "yesterday", percent: 10 })).status).toBe(400);
    expect((await r.json("/api/progress/nosuch", "PUT", { date: "2026-10-01", percent: 10 })).status).toBe(404);

    const { progress } = await r.get<{ progress: ProgressEntry[] }>("/api/progress");
    expect(progress.map((p) => `${p.date}:${p.page}`)).toEqual(["2026-09-20:40", "2026-10-01:216"]);

    expect((await r.fetch("/api/progress/b1?date=2026-10-01", { method: "DELETE" })).status).toBe(200);
    expect((await r.get<{ progress: ProgressEntry[] }>("/api/progress")).progress).toHaveLength(1);
  });
});
