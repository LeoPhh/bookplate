import { DrizzleQueryError } from "drizzle-orm/errors";
import { inspect } from "util";
import { describe, expect, it } from "vitest";
import { formatLine } from "@/lib/log";
import { removeValues } from "@/lib/db/safeErrors";

const QUERY = 'insert into "book" ("title") values ($1)';

function failure(cause: Record<string, unknown>) {
  const pg = Object.assign(new Error(String(cause.message)), cause);
  const e = new DrizzleQueryError(QUERY, ["A Secret Title", "line one\n    at line two"], pg);
  removeValues(e);
  return e;
}

// What Next.js prints, and what lib/log.ts writes.
const everywhere = (e: Error) => inspect(e, { depth: 5 }) + formatLine("error", "request.failed", { error: e });

describe("a failed query's error", () => {
  it("loses the values, in every form it gets printed", () => {
    const e = failure({
      message: 'new row for relation "book" violates check constraint "book_x"',
      code: "23514",
      constraint: "book_x",
      detail: "Failing row contains (A Secret Title).",
      where: "PL/pgSQL function with A Secret Title",
      internalQuery: "select 'A Secret Title'",
    });
    const printed = everywhere(e);
    expect(printed).not.toContain("Secret");
    expect(printed).not.toContain("line two");
  });

  it("still says which query and which constraint failed, and where", () => {
    const e = failure({ message: 'violates check constraint "book_x"', code: "23514", constraint: "book_x" });
    expect(e.message).toBe(`Failed query: ${QUERY}`);
    expect(e.stack).toContain(`Failed query: ${QUERY}`);
    expect(e.stack).toContain("safeErrors.test.ts");
    expect(e.cause).toMatchObject({ message: 'violates check constraint "book_x"', code: "23514", constraint: "book_x" });
  });

  it("loses a value Postgres quotes in a data error's message", () => {
    const e = failure({ message: 'invalid input syntax for type integer: "A Secret Title"', code: "22P02" });
    expect(everywhere(e)).not.toContain("Secret");
    expect((e.cause as Error).message).toBe("invalid input syntax for type integer");
  });
});
