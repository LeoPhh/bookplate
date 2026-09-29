import { requireUser } from "@/lib/auth";
import { getStorage, isSafeId, keys, urls } from "@/lib/storage";

const MAX_BYTES = 8 * 1024 * 1024;

// Stores an uploaded (already cropped and compressed) cover as <bookId>.jpg.
export async function POST(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const form = await request.formData();
  const file = form.get("file");
  const id = form.get("id");
  if (!(file instanceof Blob) || typeof id !== "string" || !isSafeId(id)) {
    return Response.json({ error: "Invalid upload" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "Image too large" }, { status: 413 });
  }
  const name = `${id}.jpg`;
  await getStorage().put(keys.cover(auth.userId, name), new Uint8Array(await file.arrayBuffer()));
  return Response.json({ path: urls.cover(name) });
}
