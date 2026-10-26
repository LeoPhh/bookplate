// One key per work, so the same book in two libraries can be matched (books
// in common, recommendations, and later reviews and clubs): the Open Library
// work when known (books added from the catalogue), else the ISBN (imports),
// else the title and author, tidied. Typed-in books won't always match, so
// anything built on it says "about".

export function workKey(b: { olWorkId?: string | null; isbn?: string | null; title: string; author: string }): string {
  if (b.olWorkId) return `ol:${b.olWorkId.toUpperCase()}`;
  const isbn = b.isbn ? isbn13(b.isbn) : null;
  if (isbn) return `isbn:${isbn}`;
  return `t:${tidy(b.title.split(/[:(]/)[0])}|${tidy(b.author)}`;
}

// Lower case, no accents, punctuation or leading article, single spaces.
function tidy(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/^(the|a|an) /, "");
}

// An ISBN-10 becomes its ISBN-13, so both forms of one edition match.
function isbn13(raw: string): string | null {
  const d = raw.replace(/[^0-9X]/gi, "").toUpperCase();
  if (/^\d{13}$/.test(d)) return d;
  if (!/^\d{9}[\dX]$/.test(d)) return null;
  const core = `978${d.slice(0, 9)}`;
  const sum = [...core].reduce((s, c, i) => s + Number(c) * (i % 2 ? 3 : 1), 0);
  return core + ((10 - (sum % 10)) % 10);
}
