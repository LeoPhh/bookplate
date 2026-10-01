import { requireUser } from "@/lib/auth";
import { findCover } from "@/lib/coverLookup";
import { BusyError } from "@/lib/outbound";
import { listBooks, upsertBook } from "@/lib/library";
import { checkStorage, overLimit } from "@/lib/limits";
import { getStorage, isSafeId, keys, urls } from "@/lib/storage";

// POST { bookId } finds and stores a cover for one book that has none (used
// after a Goodreads/StoryGraph import, one book at a time).
export async function POST(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const body = (await request.json().catch(() => null)) as { bookId?: unknown } | null;
  const bookId = body?.bookId;
  if (typeof bookId !== "string" || !isSafeId(bookId)) return Response.json({ error: "Invalid book" }, { status: 400 });

  const book = (await listBooks(auth.userId)).find((b) => b.id === bookId);
  if (!book) return Response.json({ error: "No such book" }, { status: 404 });
  if (book.coverImage) return Response.json({ found: true, coverImage: book.coverImage });

  let data: Uint8Array | null;
  try {
    data = await findCover(book.isbn, book.title, book.author);
  } catch (e) {
    if (!(e instanceof BusyError)) throw e;
    // Too many lookups across the server right now; the client retries.
    return Response.json({ busy: true, retryAfterMs: e.retryAfterMs }, { status: 503 });
  }
  if (!data) return Response.json({ found: false });
  const full = await checkStorage(auth.userId, data.length);
  if (full) return overLimit(full);
  const name = `${bookId}.jpg`;
  await getStorage().put(keys.cover(auth.userId, name), data);
  const coverImage = `${urls.cover(name)}?v=${Date.now()}`;
  await upsertBook(auth.userId, { ...book, coverImage });
  return Response.json({ found: true, coverImage });
}
