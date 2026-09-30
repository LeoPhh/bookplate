import { strFromU8, strToU8, unzipSync, zipSync, Zippable } from "fflate";
import { importRecords, listBooks, listVocabulary } from "./library";
import { getDb, schema } from "./db";
import { eq } from "drizzle-orm";
import { contentTypeOf, detectImageType, getStorage, isSafeFileName, isSafeId, keys } from "./storage";
import { isValidBook, isValidVocab } from "./validate";
import { Book, VocabEntry } from "./types";
import { config } from "./config";

// The export format: a zip laid out like the original Bookplate data/ folder,
// so the files stay readable without the app.
//
//   manifest.json                     { format: "bookplate-export", formatVersion: 1, … }
//   library.json                      { books: [...] }
//   vocabulary.json                   { words: [...] }
//   notes/<bookId>.md                 one markdown file per book
//   notes/images/<bookId>/<file>      images pasted into those notes
//   covers/<bookId>.jpg               cropped covers
//
// Image URLs inside books and notes (/api/covers/…, /api/notes/images/…) are
// relative to whoever is signed in, so they carry over unchanged.

export const FORMAT_VERSION = 1;

export async function buildExport(userId: string): Promise<Uint8Array> {
  const storage = getStorage();
  const [books, words, notes] = await Promise.all([
    listBooks(userId),
    listVocabulary(userId),
    getDb()
      .select({ bookId: schema.note.bookId, markdown: schema.note.markdown })
      .from(schema.note)
      .where(eq(schema.note.userId, userId)),
  ]);

  const files: Zippable = {
    "manifest.json": strToU8(
      JSON.stringify(
        { format: "bookplate-export", formatVersion: FORMAT_VERSION, appVersion: config.version, exportedAt: new Date().toISOString() },
        null,
        2
      ) + "\n"
    ),
    "library.json": strToU8(JSON.stringify({ books }, null, 2) + "\n"),
    "vocabulary.json": strToU8(JSON.stringify({ words }, null, 2) + "\n"),
  };

  for (const n of notes) {
    files[`notes/${n.bookId}.md`] = strToU8(n.markdown);
    for (const key of await storage.list(keys.notesDir(userId, n.bookId))) {
      const data = await storage.get(key);
      if (data) files[`notes/images/${n.bookId}/${key.slice(key.lastIndexOf("/") + 1)}`] = [data, { level: 0 }];
    }
  }
  for (const b of books) {
    const name = coverName(b);
    if (!name) continue;
    const data = await storage.get(keys.cover(userId, name));
    if (data) files[`covers/${name}`] = [data, { level: 0 }]; // JPEGs don't compress further
  }

  return zipSync(files, { level: 6 });
}

function coverName(b: Book): string | null {
  const name = b.coverImage?.match(/\/api\/covers\/([^/?]+)/)?.[1];
  return name && isSafeFileName(name) ? name : null;
}

export interface ImportSummary {
  books: number;
  words: number;
  notes: number;
  images: number;
  skipped: number;
}

export class ImportError extends Error {}

// Reads a Bookplate export, or a zip of an original Bookplate data/ folder
// (which has the same layout, possibly inside a top-level folder). Records
// with the same ids as existing ones are overwritten; nothing is deleted.
export async function importArchive(userId: string, zip: Uint8Array): Promise<ImportSummary> {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(zip);
  } catch {
    throw new ImportError("That file isn't a readable zip.");
  }

  // Find the folder that holds library.json; everything is relative to it.
  const libraryPath = Object.keys(entries)
    .filter((p) => p === "library.json" || p.endsWith("/library.json"))
    .filter((p) => !p.includes("__MACOSX/"))
    .sort((a, b) => a.length - b.length)[0];
  if (!libraryPath) throw new ImportError("No library.json found in the zip.");
  const root = libraryPath.slice(0, -"library.json".length);

  const manifest = readJson(entries[root + "manifest.json"]) as { formatVersion?: number } | null;
  if (manifest?.formatVersion && manifest.formatVersion > FORMAT_VERSION) {
    throw new ImportError("This export was made by a newer version of Bookplate — update this server first.");
  }

  let skipped = 0;
  const rawBooks = (readJson(entries[libraryPath]) as { books?: unknown[] } | null)?.books;
  if (!Array.isArray(rawBooks)) throw new ImportError("library.json has no books list.");
  const books: Book[] = [];
  for (const b of rawBooks) {
    if (isValidBook(b)) books.push({ ...b, status: b.status ?? "to-read" });
    else skipped++;
  }

  const rawWords = (readJson(entries[root + "vocabulary.json"]) as { words?: unknown[] } | null)?.words ?? [];
  const words: VocabEntry[] = [];
  for (const w of rawWords) {
    if (isValidVocab(w)) words.push(w);
    else skipped++;
  }

  const notes: Record<string, string> = {};
  const images: { key: string; data: Uint8Array }[] = [];
  for (const [path, data] of Object.entries(entries)) {
    if (!path.startsWith(root) || path.endsWith("/")) continue;
    const rel = path.slice(root.length);
    let m: RegExpMatchArray | null;
    if ((m = rel.match(/^notes\/([^/]+)\.md$/)) && isSafeId(m[1])) {
      notes[m[1]] = strFromU8(data);
    } else if ((m = rel.match(/^notes\/images\/([^/]+)\/([^/]+)$/)) && isSafeId(m[1]) && isSafeFileName(m[2])) {
      if (isImageNamed(m[2], data)) images.push({ key: keys.notesImage(userId, m[1], m[2]), data });
      else skipped++;
    } else if ((m = rel.match(/^covers\/([^/]+)$/)) && isSafeFileName(m[1])) {
      if (isImageNamed(m[1], data)) images.push({ key: keys.cover(userId, m[1]), data });
      else skipped++;
    }
  }

  // Images first: if the database write fails, a retry just overwrites them.
  const storage = getStorage();
  for (const img of images) await storage.put(img.key, img.data);
  await importRecords(userId, { books, words, notes });

  return {
    books: books.length,
    words: words.length,
    notes: Object.keys(notes).length,
    images: images.length,
    skipped,
  };
}

// Only store files whose contents really are the image type their name says.
function isImageNamed(name: string, data: Uint8Array): boolean {
  return detectImageType(data) === contentTypeOf(name);
}

function readJson(data: Uint8Array | undefined): unknown {
  if (!data) return null;
  try {
    return JSON.parse(strFromU8(data));
  } catch {
    throw new ImportError("A JSON file in the zip could not be read.");
  }
}
