import { sql } from "drizzle-orm";
import { getDb } from "../db";
import type { Visibility } from "./profile";

// Who may see what of another reader's, as on Instagram. The top of a profile
// (name, photo, username, bio, bookplate, how many books and friends they have)
// is open to anyone but a reader blocked either way. The rest (books, the other
// numbers, their goal, who their friends are) is for anyone on a public profile,
// and on a private one for friends only. Every cross-reader read goes through audienceFor and canSeeReading, and anything
// hidden is "not found", never "forbidden".

// What the viewer is to the owner. Signed-out visitors are strangers.
export type Audience = "self" | "friend" | "stranger" | "blocked";

// A pair of readers in the order friendships store them (smaller id first, by bytes: friendship_order checks the same).
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

// Whether this audience sees the whole of a profile with this visibility.
export function canSeeReading(audience: Audience, visibility: Visibility): boolean {
  switch (audience) {
    case "self":
      return true;
    case "friend":
      return true;
    case "stranger":
      return visibility === "public";
    case "blocked":
      return false;
  }
}
