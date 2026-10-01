import { requireUser } from "@/lib/auth";
import { deleteProgress, getBook, upsertProgress } from "@/lib/library";
import { isValidProgress } from "@/lib/validate";

type Params = { params: Promise<{ bookId: string }> };

// PUT { date, page?, percent } records a day's progress for one book,
// replacing any earlier update from the same day.
export async function PUT(request: Request, { params }: Params) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { bookId } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const entry = { ...body, bookId };
  if (!isValidProgress(entry)) return Response.json({ error: "Invalid progress" }, { status: 400 });
  const book = await getBook(auth.userId, bookId);
  if (!book) return Response.json({ error: "No such book" }, { status: 404 });
  if (entry.page != null && book.pages && entry.page > book.pages) {
    return Response.json({ error: `This book has ${book.pages} pages` }, { status: 400 });
  }
  await upsertProgress(auth.userId, { bookId, date: entry.date, page: entry.page ?? undefined, percent: entry.percent });
  return Response.json({ ok: true });
}

// DELETE ?date=yyyy-mm-dd removes one day's update.
export async function DELETE(request: Request, { params }: Params) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { bookId } = await params;
  const date = new URL(request.url).searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Response.json({ error: "Invalid date" }, { status: 400 });
  await deleteProgress(auth.userId, bookId, date);
  return Response.json({ ok: true });
}
