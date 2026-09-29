import { requireUser } from "@/lib/auth";
import { listNotedBookIds } from "@/lib/library";

// GET returns the ids of books that have notes, so the library can mark them
// without fetching every note.
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  return Response.json({ ids: await listNotedBookIds(auth.userId) });
}
