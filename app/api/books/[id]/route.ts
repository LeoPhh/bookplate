import { requireUser } from "@/lib/auth";
import { deleteBook, upsertBook } from "@/lib/library";
import { isSafeId } from "@/lib/storage";
import { isValidBook } from "@/lib/validate";

// PUT creates or replaces one book. Saving one record at a time means two
// open tabs editing different books never overwrite each other.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!isSafeId(id) || !isValidBook(body) || body.id !== id) {
    return Response.json({ error: "Invalid book" }, { status: 400 });
  }
  await upsertBook(auth.userId, body);
  return Response.json({ ok: true });
}

// DELETE removes the book with its notes, pasted images, and cover.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { id } = await params;
  await deleteBook(auth.userId, id);
  return Response.json({ ok: true });
}
