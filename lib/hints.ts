import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "./db";

// Info boxes (components/Hint.tsx) a reader can turn off for good. The
// choice is kept on the account, so it holds on every device.
export const HINTS = ["vocabulary"] as const;
export type HintId = (typeof HINTS)[number];

export const isHint = (id: unknown): id is HintId => typeof id === "string" && (HINTS as readonly string[]).includes(id);

export async function dismissedHints(userId: string): Promise<string[]> {
  const [row] = await getDb()
    .select({ hints: schema.user.dismissedHints })
    .from(schema.user)
    .where(eq(schema.user.id, userId));
  return row?.hints ?? [];
}

// Adds the hint once, however often it's dismissed.
export async function dismissHint(userId: string, hint: HintId): Promise<string[]> {
  const col = schema.user.dismissedHints;
  const [row] = await getDb()
    .update(schema.user)
    .set({ dismissedHints: sql`CASE WHEN ${hint} = ANY(${col}) THEN ${col} ELSE array_append(${col}, ${hint}) END` })
    .where(eq(schema.user.id, userId))
    .returning({ hints: col });
  return row?.hints ?? [];
}
