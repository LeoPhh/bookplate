import { PALETTE } from "./palette";

// The picture a reader has until they add a photo: their initials on a colour.

// "Madonna" → "M", "Sam Carter" → "SC", "Mary Ann Evans" → "ME". Goes by whole
// characters, so accents and other scripts stay in one piece.
export function initials(label: string): string {
  const words = label.trim().replace(/^@/, "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const first = (w: string) => [...w][0];
  const letters = words.length > 1 ? first(words[0]) + first(words[words.length - 1]) : first(words[0]);
  return letters.toUpperCase();
}

// The bright bindings: a reader who hasn't chosen gets one of these.
const STARTING = [0, 1, 2, 3, 4, 6, 7, 8];

// The colour the reader chose, or the one their account id always picks.
export function avatarColorIndex(userId: string, chosen: number | null | undefined): number {
  if (typeof chosen === "number" && Number.isInteger(chosen) && chosen >= 0 && chosen < PALETTE.length) return chosen;
  let hash = 2166136261;
  for (const c of userId) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  // The low bits alone would clump: fold the high ones in.
  return STARTING[((hash ^ (hash >>> 15)) >>> 0) % STARTING.length];
}
