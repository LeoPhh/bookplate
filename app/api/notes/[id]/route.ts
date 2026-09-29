import { requireUser } from "@/lib/auth";
import { deleteNotes, readNotes, reconcileNotesImages, writeNotes } from "@/lib/library";
import { isSafeId } from "@/lib/storage";

const MAX_BYTES = 2 * 1024 * 1024; // plenty for markdown text

// GET returns a book's markdown notes, or null when none have been written.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { id } = await params;
  return Response.json({ notes: await readNotes(auth.userId, id) });
}

// PUT replaces the whole note (the editor always holds the full text).
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
  const notes = (body as { notes?: unknown })?.notes;
  if (!isSafeId(id) || typeof notes !== "string" || notes.length > MAX_BYTES) {
    return Response.json({ error: "Invalid notes payload" }, { status: 400 });
  }
  await writeNotes(auth.userId, id, notes);
  // Every save doubles as garbage collection for pasted-then-removed images.
  await reconcileNotesImages(auth.userId, id, notes);
  return Response.json({ ok: true });
}

// DELETE removes the notes and their pasted images.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { id } = await params;
  if (!isSafeId(id)) return Response.json({ error: "Invalid book id" }, { status: 400 });
  await deleteNotes(auth.userId, id);
  return Response.json({ ok: true });
}
