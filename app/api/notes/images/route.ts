import { randomUUID } from "crypto";
import { requireUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { checkStorage, overLimit, tooLarge } from "@/lib/limits";
import { detectImageType, EXT_BY_TYPE, getStorage, isSafeId, keys, urls } from "@/lib/storage";

// Stores an image pasted into a book's notes. Pasted images keep their
// original encoding, detected from the file's contents; the extension then
// drives the Content-Type when served.
export async function POST(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const form = await request.formData();
  const file = form.get("file");
  const bookId = form.get("bookId");
  if (!(file instanceof Blob) || typeof bookId !== "string" || !isSafeId(bookId)) {
    return Response.json({ error: "Invalid upload" }, { status: 400 });
  }
  const large = tooLarge(file.size, config.limits.uploadBytes);
  if (large) return large;
  const data = new Uint8Array(await file.arrayBuffer());
  const type = detectImageType(data);
  const ext = type ? EXT_BY_TYPE[type] : undefined;
  if (!ext) {
    return Response.json({ error: "Unsupported image type" }, { status: 415 });
  }
  const full = await checkStorage(auth.userId, data.length);
  if (full) return overLimit(full);
  const name = `${randomUUID()}.${ext}`;
  await getStorage().put(keys.notesImage(auth.userId, bookId, name), data);
  return Response.json({ path: urls.notesImage(bookId, name) });
}
