import { hasBeenRead } from "../reads";
import type { Book } from "../types";
import type { Audience } from "./access";
import type { Profile } from "./profile";

// What other readers may see of a reader's books. Every field of Book is
// listed here, so a new one doesn't compile until someone decides: notes,
// sources, copies and when a book was added are never shown.
const SHOWN = {
  id: true,
  title: true,
  author: true,
  isbn: true,
  olWorkId: true,
  genre: true,
  pages: true,
  format: false, // where it came from
  status: true,
  copy: false, // whether they own one
  rating: true, // unless they don't share ratings
  dateRead: true,
  pastReads: true,
  notes: false,
  coverImage: true, // at the profile's own cover address
  colorIndex: true,
  addedAt: false,
} satisfies Record<keyof Book, boolean>;

export const SHOWN_FIELDS = Object.keys(SHOWN).filter((k) => SHOWN[k as keyof Book]) as (keyof Book)[];

// "/api/covers/<file>?v=…" → "/u/<handle>/covers/<file>?v=…"
const COVER = /^\/api\/covers\/([^/?]+)(\?.*)?$/;
export function profileCover(handle: string, coverImage: string): string | undefined {
  const m = coverImage.match(COVER);
  return m ? `/u/${handle}/covers/${m[1]}${m[2] ?? ""}` : undefined;
}

// "/api/avatar/<file>" → "/u/<handle>/avatar/<file>"
export function profileAvatar(handle: string, image: string | null | undefined): string | null {
  const m = image?.match(/^\/api\/avatar\/([^/?]+)$/);
  return m ? `/u/${handle}/avatar/${m[1]}` : null;
}

// Which books this audience sees: anyone the profile is shown to sees what
// was read; friends also see the to-read shelf, and what's being read when
// it's shared. Books given up on stay private.
export function visibleBooks(books: Book[], audience: Audience, p: Profile): Book[] {
  if (audience === "self") return books;
  return books.filter(
    (b) =>
      hasBeenRead(b) ||
      (audience === "friend" && (b.status === "to-read" || (b.status === "reading" && p.shareReading)))
  );
}

// One book as others see it. With a handle, its cover moves to that profile's
// cover address, which other readers may load; null keeps the owner's own.
export function personBook(b: Book, p: Pick<Profile, "shareRatings">, handle: string | null): Book {
  const out = {} as Record<string, unknown>;
  for (const k of SHOWN_FIELDS) if (b[k] !== undefined) out[k] = b[k];
  const shown = out as unknown as Book;
  if (!p.shareRatings) shown.rating = 0;
  if (handle !== null) shown.coverImage = shown.coverImage ? profileCover(handle, shown.coverImage) : undefined;
  return shown;
}
