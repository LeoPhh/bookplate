import { requireUser } from "@/lib/auth";
import { listBooks } from "@/lib/library";

// GET returns the signed-in user's whole library.
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  return Response.json({ books: await listBooks(auth.userId) });
}
