import { requireUser } from "@/lib/auth";
import { importArchive, ImportError } from "@/lib/archive";
import { config } from "@/lib/config";
import { tooLarge } from "@/lib/limits";

// POST takes a Bookplate export (or a zipped data/ folder from the original
// app) and merges it into the signed-in user's library.
export async function POST(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) return Response.json({ error: "No file uploaded" }, { status: 400 });
  const large = tooLarge(file.size, config.limits.importBytes, "That file");
  if (large) return large;
  try {
    const summary = await importArchive(auth.userId, new Uint8Array(await file.arrayBuffer()));
    return Response.json({ ok: true, summary });
  } catch (e) {
    if (e instanceof ImportError) return Response.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
