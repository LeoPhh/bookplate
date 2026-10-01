import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { checkStorage, overLimit } from "@/lib/limits";
import { detectImageType, getStorage, keys, urls } from "@/lib/storage";

// The browser crops and compresses the photo to a small JPEG first.
const MAX_BYTES = 1024 * 1024;

async function setImage(userId: string, image: string | null) {
  await getDb().update(schema.user).set({ image, updatedAt: new Date() }).where(eq(schema.user.id, userId));
}

// POST stores a new profile photo and replaces the old one. Each photo gets a
// fresh file name, so browsers never show a stale cached copy.
export async function POST(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) return Response.json({ error: "Invalid upload" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "Image too large" }, { status: 413 });
  const data = new Uint8Array(await file.arrayBuffer());
  if (detectImageType(data) !== "image/jpeg") {
    return Response.json({ error: "Profile photos must be JPEG images" }, { status: 415 });
  }

  const full = await checkStorage(auth.userId, data.length);
  if (full) return overLimit(full);
  const storage = getStorage();
  const name = `${randomUUID()}.jpg`;
  const key = keys.avatar(auth.userId, name);
  await storage.put(key, data);
  await setImage(auth.userId, urls.avatar(name));
  // Drop earlier photos only once the new one is in place.
  const old = (await storage.list(keys.avatarDir(auth.userId))).filter((k) => k !== key);
  await Promise.all(old.map((k) => storage.delete(k)));
  return Response.json({ image: urls.avatar(name) });
}

// DELETE removes the photo; the default bookshelf picture shows instead.
export async function DELETE() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  await setImage(auth.userId, null);
  await getStorage().deletePrefix(keys.avatarDir(auth.userId));
  return Response.json({ ok: true });
}
