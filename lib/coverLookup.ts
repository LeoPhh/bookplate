import { USER_AGENT } from "./config";
import { pace } from "./outbound";
import { detectImageType } from "./storage";

const UA = { "User-Agent": USER_AGENT };

export interface ItunesResult {
  trackName?: string;
  artistName?: string;
  artworkUrl100?: string;
}

const norm = (v: string) =>
  v
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// The title (before any subtitle) and the author's surname must both match.
export function sameBook(r: ItunesResult, title: string, author: string): boolean {
  const want = norm(title.split(/[:(]/)[0]);
  const got = norm((r.trackName ?? "").split(/[:(]/)[0]);
  const surname = norm(author).split(" ").pop();
  if (!want || !got || !surname) return false;
  return norm(r.artistName ?? "").includes(surname) && (got === want || got.startsWith(want) || want.startsWith(got));
}

// Finds a cover for a book that has none: Open Library by ISBN first, then
// iTunes ebook artwork by title and author. Returns JPEG bytes, or null.
//
// Both services limit how often one server may ask (lib/outbound.ts). When
// every reader's imports together need more than that, this throws
// BusyError rather than queue for long; the Settings page then waits and
// asks again.
export async function findCover(isbn: string | undefined, title: string, author: string): Promise<Uint8Array | null> {
  if (isbn) {
    await pace("coversByIsbn", 10_000);
    try {
      // default=false makes a missing cover a 404 instead of a blank image.
      const res = await fetch(`https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`, {
        headers: UA,
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        const data = new Uint8Array(await res.arrayBuffer());
        if (data.byteLength > 1000 && detectImageType(data) === "image/jpeg") return data;
      }
    } catch {
      // unreachable or slow — try the fallback
    }
  }

  await pace("itunes", 10_000);
  try {
    const term = encodeURIComponent(`${title} ${author}`.trim());
    const res = await fetch(`https://itunes.apple.com/search?term=${term}&media=ebook&limit=5`, {
      headers: UA,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const json: { results?: ItunesResult[] } = await res.json();
    // iTunes always returns *something*; only take a result that is this book.
    const art = json.results?.find((r) => sameBook(r, title, author))?.artworkUrl100;
    if (!art) return null;
    const img = await fetch(art.replace(/100x100bb\.jpg$/, "600x0w.jpg"), { headers: UA, signal: AbortSignal.timeout(10_000) });
    if (!img.ok) return null;
    const data = new Uint8Array(await img.arrayBuffer());
    return detectImageType(data) === "image/jpeg" ? data : null;
  } catch {
    return null;
  }
}
