import { requireUser } from "@/lib/auth";
import { getStorage, isSafeFileName, keys } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { name } = await params;
  if (!isSafeFileName(name)) return new Response("Not found", { status: 404 });
  const data = await getStorage().get(keys.cover(auth.userId, name));
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(data as Uint8Array<ArrayBuffer>, {
    headers: {
      "Content-Type": "image/jpeg",
      // Cover URLs carry a ?v= cache-buster, so the file itself can cache hard
      // (privately: covers belong to the signed-in user).
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { name } = await params;
  if (!isSafeFileName(name)) return Response.json({ error: "Invalid name" }, { status: 400 });
  await getStorage().delete(keys.cover(auth.userId, name));
  return Response.json({ ok: true });
}
