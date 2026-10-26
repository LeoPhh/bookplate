import { hasBeenRead } from "../reads";
import type { Book } from "../types";
import { workKey } from "./workKey";

// How one reader's reading compares with another's: the books both have
// read (matched by lib/social/workKey.ts, so "about"), and how closely their
// ratings of those agree. Pure; the viewer's own books go in but only the
// other reader's (already cut down to what the viewer may see) come out.

export interface Taste {
  common: Book[]; // theirs, in their order
  rated: number; // of those, how many both rated
  match?: number; // 0–100: how close those ratings are, once there are enough
}

// Fewer books rated in common than this says too little to call it a match.
export const MATCH_MIN = 3;

export function compareTaste(mine: Book[], theirs: Book[]): Taste {
  const myRating = new Map<string, number>();
  for (const b of mine.filter(hasBeenRead)) {
    const k = workKey(b);
    myRating.set(k, Math.max(myRating.get(k) ?? 0, b.rating));
  }
  const seen = new Set<string>();
  const common: Book[] = [];
  const pairs: [number, number][] = [];
  for (const b of theirs.filter(hasBeenRead)) {
    const k = workKey(b);
    if (!myRating.has(k) || seen.has(k)) continue;
    seen.add(k);
    common.push(b);
    const mineRated = myRating.get(k)!;
    if (mineRated > 0 && b.rating > 0) pairs.push([mineRated, b.rating]);
  }
  // Ratings run 0.5–5, so the furthest apart two can be is 4.5 stars.
  const match =
    pairs.length >= MATCH_MIN
      ? Math.round((1 - pairs.reduce((s, [a, b]) => s + Math.abs(a - b), 0) / pairs.length / 4.5) * 100)
      : undefined;
  return { common, rated: pairs.length, match };
}
