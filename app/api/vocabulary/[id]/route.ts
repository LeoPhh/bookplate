import { requireUser } from "@/lib/auth";
import { deleteVocab, upsertVocab } from "@/lib/library";
import { checkWords, overLimit } from "@/lib/limits";
import { isSafeId } from "@/lib/storage";
import { isValidVocab } from "@/lib/validate";

// PUT creates or replaces one word.
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
  if (!isSafeId(id) || !isValidVocab(body) || body.id !== id) {
    return Response.json({ error: "Invalid word" }, { status: 400 });
  }
  const over = await checkWords(auth.userId, [id]);
  if (over) return overLimit(over);
  await upsertVocab(auth.userId, body);
  return Response.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { id } = await params;
  await deleteVocab(auth.userId, id);
  return Response.json({ ok: true });
}
