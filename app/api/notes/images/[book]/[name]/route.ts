import { requireUser } from "@/lib/auth";
import { contentTypeOf, getStorage, isSafeFileName, isSafeId, keys } from "@/lib/storage";

type Params = { params: Promise<{ book: string; name: string }> };

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { book, name } = await params;
  if (!isSafeId(book) || !isSafeFileName(name)) return new Response("Not found", { status: 404 });
  const data = await getStorage().get(keys.notesImage(auth.userId, book, name));
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(data as Uint8Array<ArrayBuffer>, {
    headers: {
      "Content-Type": contentTypeOf(name),
      // Filenames are random UUIDs and never rewritten, so cache hard.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { book, name } = await params;
  if (!isSafeId(book) || !isSafeFileName(name)) return Response.json({ error: "Invalid name" }, { status: 400 });
  await getStorage().delete(keys.notesImage(auth.userId, book, name));
  return Response.json({ ok: true });
}
