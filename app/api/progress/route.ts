import { requireUser } from "@/lib/auth";
import { listProgress } from "@/lib/library";

// GET returns every reading-progress update, oldest first.
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  return Response.json({ progress: await listProgress(auth.userId) });
}
