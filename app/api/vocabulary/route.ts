import { requireUser } from "@/lib/auth";
import { listVocabulary } from "@/lib/library";

// GET returns the signed-in user's word registry.
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  return Response.json({ words: await listVocabulary(auth.userId) });
}
