import { sql } from "drizzle-orm";
import { getDb } from "../db";
import type { Visibility } from "./profile";

// Who may see what of another reader's. Every cross-reader read goes through
// audienceFor and canSee: anything hidden is "not found", never "forbidden",
// so nobody can tell a hidden profile from a missing one.

// What the viewer is to the owner. Signed-out visitors are strangers.
export type Audience = "self" | "friend" | "stranger" | "blocked";

// A pair of readers in the order friendships store them (smaller id first).
export const pairOf = (a: string, b: string): [string, string] => (a < b ? [a, b] : [b, a]);

export async function audienceFor(viewerId: string | null, ownerId: string): Promise<Audience> {
  if (viewerId === ownerId) return "self";
  if (!viewerId) return "stranger";
  const [a, b] = pairOf(viewerId, ownerId);
  const { rows } = await getDb().execute<{ blocked: boolean; friend: boolean }>(sql`
    SELECT
      EXISTS (SELECT 1 FROM block WHERE (blocker = ${viewerId} AND blocked = ${ownerId})
                                    OR (blocker = ${ownerId} AND blocked = ${viewerId})) AS blocked,
      EXISTS (SELECT 1 FROM friendship WHERE user_a = ${a} AND user_b = ${b}) AS friend`);
  if (rows[0]?.blocked) return "blocked";
  return rows[0]?.friend ? "friend" : "stranger";
}

// Whether this audience sees a profile with this visibility at all.
export function canSee(audience: Audience, visibility: Visibility): boolean {
  switch (audience) {
    case "self":
      return true;
    case "friend":
      return visibility !== "private";
    case "stranger":
      return visibility === "public";
    case "blocked":
      return false;
  }
}
